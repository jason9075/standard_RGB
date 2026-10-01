import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import renderMathInElement from 'katex/dist/contrib/auto-render';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript.js';
import './style.css';
import { srgbToLinear, displayByte } from './color-math.js';
import { materialCatalog, materialUrl, loadMaterial, disposeMaterials } from './materials.js';

const $ = (id) => document.getElementById(id);
const state = { stage: 'color', light: 2, texture: 'gray', decode: true, roughnessDecode: true, roughnessPixel: 128 };
const presets = { gray: [128, 128, 128], clay: [180, 100, 74], sage: [113, 151, 120] };
let selectedMaterial = null;
for (const asset of materialCatalog) {
  const option = document.createElement('option');
  option.value = asset.id;
  option.textContent = asset.label;
  $('texture-select').appendChild(option);
}
const descriptions = {
  color: ['OBSERVE / BASE COLOR', 'Same pixels. Different interpretation.', "Move the light. Only the texture's color-space interpretation changes.", 'BASE COLOR COMPARISON'],
  pipeline: ['MANIPULATE / THE PIPELINE', 'Break the decode. Follow the value.', 'Switch decoding off and watch the numbers travel through the renderer.', 'BASE COLOR SANDBOX'],
  roughness: ['UNDERSTAND / NUMERIC DATA', 'Same image. A different kind of data.', 'These pixels describe roughness. Decoding them changes the material.', 'ROUGHNESS COMPARISON'],
};
const format = (value) => value.toFixed(3);
const rgb = (values) => values.map(format).join(' / ');
function values(id, entries, classes = []) {
  const parent = $(id);
  parent.replaceChildren(...entries.map((entry, i) => {
    const span = document.createElement('span');
    if (parent.classList.contains('numeric') && entry.includes(' / ')) {
      entry.split(' / ').forEach((channel, index) => {
        if (index) span.append(' / ');
        const value = document.createElement('span');
        value.className = 'value-channel';
        value.textContent = channel;
        span.appendChild(value);
      });
    } else {
      span.textContent = entry;
    }
    if (classes[i]) span.className = classes[i];
    return span;
  }));
  parent.classList.toggle('single', entries.length === 1);
}

// Separate texture metadata, identical byte storage. Only interpretation differs.
const baseBytes = new Uint8Array([128, 128, 128, 255]);
function baseTexture(colorSpace) {
  const texture = new THREE.DataTexture(baseBytes, 1, 1, THREE.RGBAFormat);
  texture.colorSpace = colorSpace;
  texture.needsUpdate = true;
  return texture;
}
const encodedTexture = baseTexture(THREE.SRGBColorSpace);
const undecodedTexture = baseTexture(THREE.NoColorSpace);
const roughnessBytes = new Uint8Array([128, 128, 128, 255]);
const roughnessTexture = new THREE.DataTexture(roughnessBytes, 1, 1, THREE.RGBAFormat);
roughnessTexture.colorSpace = THREE.NoColorSpace;
roughnessTexture.needsUpdate = true;

const colorMaterial = new THREE.MeshStandardMaterial({ map: encodedTexture, roughness: 0.5, metalness: 0 });
const wrongColorMaterial = colorMaterial.clone();
wrongColorMaterial.map = undecodedTexture;
const inputSampleUniform = { value: 0 };
for (const material of [colorMaterial, wrongColorMaterial]) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.sampleBaseInput = inputSampleUniform;
    shader.fragmentShader = `uniform float sampleBaseInput;\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      #include <opaque_fragment>
      if (sampleBaseInput > 0.5) {
        gl_FragColor = vec4(diffuseColor.rgb, 1.0);
        return;
      }
    `);
  };
  material.customProgramCacheKey = () => 'gfx-lab-base-color-input-sample-v1';
}
const dataMaterial = new THREE.MeshStandardMaterial({ color: '#bec5cf', roughness: 1, metalness: 0.85, roughnessMap: roughnessTexture });
const wrongDataMaterial = dataMaterial.clone();
const roughnessDecodeUniform = { value: 1 };
// A roughness map is data. Apply an explicit incorrect transfer in the shader
// instead of relying on unsupported color annotations for non-color maps.
wrongDataMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.decodeRoughness = roughnessDecodeUniform;
  shader.fragmentShader = `uniform float decodeRoughness;\n${shader.fragmentShader}`;
  shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
    float roughnessFactor = roughness;
    #ifdef USE_ROUGHNESSMAP
      vec4 texelRoughness = texture2D(roughnessMap, vRoughnessMapUv);
      float storedRoughness = texelRoughness.g;
      float decodedRoughness = sRGBTransferEOTF(vec4(vec3(storedRoughness), 1.0)).g;
      roughnessFactor *= mix(storedRoughness, decodedRoughness, decodeRoughness);
    #endif
  `);
};
wrongDataMaterial.customProgramCacheKey = () => 'gfx-lab-explicit-roughness-decode-v1';

let renderer, scene, camera, mesh, keyLight, environmentTarget, sampleTarget;
let pendingFrame = false;
let renderGeneration = 0;

function setupRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas: $('canvas'), antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // An explicit identity tone transform keeps this experiment focused on encoding.
  renderer.toneMapping = THREE.NoToneMapping;
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#2e3440');
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 30);
  camera.position.set(0, 0, 5.1);
  mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), colorMaterial);
  scene.add(mesh);
  keyLight = new THREE.DirectionalLight(0xffffff, state.light);
  keyLight.position.set(3, 4, 5);
  scene.add(keyLight);
  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  environmentTarget = pmrem.fromScene(room, 0.04);
  scene.environment = environmentTarget.texture;
  room.dispose();
  pmrem.dispose();
  if (renderer.extensions.has('EXT_color_buffer_float')) {
    sampleTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.FloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      colorSpace: THREE.LinearSRGBColorSpace,
    });
  } else {
    $('result-note').textContent = 'Float sampling is unavailable on this device.';
  }
  new ResizeObserver(requestRender).observe($('viewport'));
  $('canvas').addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    $('render-error').textContent = 'The graphics context was lost. Reload to restore the experiment.';
    $('render-error').hidden = false;
  });
  window.addEventListener('pagehide', dispose, { once: true });
}

function dispose(event) {
  if (event.persisted) return;
  mesh.geometry.dispose();
  [colorMaterial, wrongColorMaterial, dataMaterial, wrongDataMaterial].forEach((material) => material.dispose());
  [encodedTexture, undecodedTexture, roughnessTexture].forEach((texture) => texture.dispose());
  disposeMaterials();
  sampleTarget?.dispose();
  environmentTarget.dispose();
  renderer.dispose();
}

function requestRender() {
  if (!renderer || pendingFrame) return;
  pendingFrame = true;
  requestAnimationFrame(render);
}

function activeMaterials() {
  if (state.stage === 'roughness') return [wrongDataMaterial, dataMaterial];
  if (state.stage === 'pipeline') return [state.decode ? colorMaterial : wrongColorMaterial];
  return [wrongColorMaterial, colorMaterial];
}

function render() {
  pendingFrame = false;
  const generation = ++renderGeneration;
  const { width, height } = $('viewport').getBoundingClientRect();
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  keyLight.intensity = state.light;
  // All illumination, including the shared neutral environment, follows the slider.
  scene.environmentIntensity = state.light * 0.16;
  roughnessDecodeUniform.value = Number(state.roughnessDecode);
  const materials = activeMaterials();
  const viewWidth = width / materials.length;
  // Keep the whole sphere inside each narrow mobile viewport.
  camera.position.z = Math.max(5.1, 4 * height / viewWidth);
  camera.aspect = viewWidth / height;
  camera.updateProjectionMatrix();
  renderer.setRenderTarget(null);
  renderer.setScissorTest(true);
  materials.forEach((material, i) => {
    mesh.material = material;
    renderer.setViewport(viewWidth * i, 0, viewWidth, height);
    renderer.setScissor(viewWidth * i, 0, viewWidth, height);
    renderer.render(scene, camera);
  });
  renderer.setScissorTest(false);

  if (!sampleTarget) return;
  // Render exactly the center pixel's camera ray into a linear float target.
  // No guessed lighting multiplier or reverse-engineered display value is used.
  const pixelRatio = renderer.getPixelRatio();
  const fullWidth = Math.max(1, Math.floor(viewWidth * pixelRatio));
  const fullHeight = Math.max(1, Math.floor(height * pixelRatio));
  const capture = (material) => {
    mesh.material = material;
    camera.setViewOffset(fullWidth, fullHeight, Math.floor(fullWidth / 2), Math.floor(fullHeight / 2), 1, 1);
    renderer.setRenderTarget(sampleTarget);
    renderer.render(scene, camera);
    return renderer.readRenderTargetPixelsAsync(sampleTarget, 0, 0, 1, 1, new Float32Array(4));
  };
  const reads = materials.map(capture);
  const sampleTexture = selectedMaterial && state.stage !== 'roughness';
  const inputReads = [];
  if (sampleTexture) {
    inputSampleUniform.value = 1;
    inputReads.push(capture(wrongColorMaterial), capture(colorMaterial));
    inputSampleUniform.value = 0;
  }
  camera.clearViewOffset();
  renderer.setRenderTarget(null);
  renderer.setViewport(0, 0, width, height);
  Promise.all([...reads, ...inputReads]).then((results) => {
    if (generation !== renderGeneration) return;
    $('scene-values').setAttribute('aria-busy', 'false');
    const samples = results.slice(0, materials.length);
    values('scene-values', samples.map((sample) => rgb(Array.from(sample).slice(0, 3))));
    values('display-values', samples.map((sample) => Array.from(sample).slice(0, 3).map(displayByte).join(' / ')));
    $('result-note').textContent = 'Actual center pixel, before display encoding';
    if (sampleTexture) {
      const [encoded, decoded] = results.slice(materials.length).map((sample) => Array.from(sample).slice(0, 3));
      $('stored-value').textContent = rgb(encoded);
      $('left-value').textContent = rgb(state.stage === 'pipeline' && state.decode ? decoded : encoded);
      $('right-value').textContent = rgb(decoded);
      values('linear-values', state.stage === 'pipeline' ? [rgb(state.decode ? decoded : encoded)] : [rgb(encoded), rgb(decoded)]);
    }
  }).catch((error) => {
    if (generation !== renderGeneration) return;
    $('scene-values').setAttribute('aria-busy', 'false');
    values('scene-values', materials.map(() => 'Unavailable'));
    values('display-values', materials.map(() => 'Unavailable'));
    $('result-note').textContent = 'GPU pixel readback is unavailable on this device.';
    console.error(error);
  });
}

function update({ preserveSamples = false } = {}) {
  // Invalidate earlier reads immediately; keep the last completed sample on drag.
  renderGeneration++;
  $('scene-values').setAttribute('aria-busy', String(Boolean(sampleTarget)));
  const isRoughness = state.stage === 'roughness';
  const isSingle = state.stage === 'pipeline';
  const copy = descriptions[state.stage];
  ['stage-eyebrow', 'stage-title', 'stage-description', 'scene-caption'].forEach((id, i) => { $(id).textContent = copy[i]; });
  document.querySelectorAll('[data-stage]').forEach((tab) => {
    const active = tab.dataset.stage === state.stage;
    tab.classList.toggle('active', active);
    if (active) tab.setAttribute('aria-current', 'step');
    else tab.removeAttribute('aria-current');
  });
  ['viewport', 'view-labels', 'view-readouts'].forEach((id) => $(id).classList.toggle('single', isSingle));
  ['right-view-label', 'right-view-readout', 'pipeline-columns'].forEach((id) => { $(id).hidden = isSingle; });
  $('color-control').hidden = isRoughness;
  $('roughness-control').hidden = !isRoughness;
  $('decode-control').hidden = !isSingle;
  $('roughness-decode-control').hidden = !isRoughness;
  $('light-value').value = state.light.toFixed(2);
  $('roughness-pixel-value').value = state.roughnessPixel;
  $('decode-toggle').checked = state.decode;
  $('roughness-decode-toggle').checked = state.roughnessDecode;
  $('pipeline-tag').textContent = isRoughness ? 'DATA / G' : 'RGB';
  $('canvas').setAttribute('aria-label', isSingle ? 'Sphere rendered with adjustable sRGB decoding' : `Two spheres with identical conditions comparing ${isRoughness ? 'roughness data' : 'base color'} interpretation`);

  const textureRgb = presets[state.texture] ?? presets.gray;
  if (!selectedMaterial) {
    baseBytes.set(textureRgb);
    encodedTexture.needsUpdate = true;
    undecodedTexture.needsUpdate = true;
  }
  roughnessBytes.fill(state.roughnessPixel, 0, 3);
  roughnessTexture.needsUpdate = true;
  $('texture-swatch').style.background = `rgb(${textureRgb.join(',')})`;
  $('texture-bytes').textContent = selectedMaterial ? `${selectedMaterial.asset.id} · 1K · CC0` : `RGB · ${textureRgb.join(' / ')}`;
  $('pipeline-swatch').style.background = isRoughness ? `rgb(${state.roughnessPixel}, ${state.roughnessPixel}, ${state.roughnessPixel})` : `rgb(${textureRgb.join(',')})`;
  if (selectedMaterial) {
    $('texture-swatch').style.backgroundImage = `url("${materialUrl(selectedMaterial.asset)}")`;
    $('texture-swatch').style.backgroundSize = 'cover';
    if (!isRoughness) {
      $('pipeline-swatch').style.backgroundImage = `url("${materialUrl(selectedMaterial.asset)}")`;
      $('pipeline-swatch').style.backgroundSize = 'cover';
    }
  }

  const encoded = textureRgb.map((value) => value / 255);
  const decoded = encoded.map(srgbToLinear);
  const rawRoughness = state.roughnessPixel / 255;
  const wrongRoughness = state.roughnessDecode ? srgbToLinear(rawRoughness) : rawRoughness;
  const wrong = isRoughness ? state.roughnessDecode : isSingle ? !state.decode : true;
  $('left-badge').className = `badge ${wrong ? 'wrong' : 'correct'}`;
  $('left-badge').textContent = wrong ? 'INCORRECT' : 'CORRECT';
  $('left-label').textContent = isRoughness ? (state.roughnessDecode ? 'Roughness as sRGB' : 'Roughness as Data') : isSingle && state.decode ? 'sRGB → Linear' : 'No sRGB Decode';
  $('right-label').textContent = isRoughness ? 'Roughness as Data' : 'sRGB → Linear';
  $('left-subtitle').textContent = isRoughness ? (state.roughnessDecode ? 'Decoded data → smoother material' : 'Original material values preserved') : wrong ? 'Encoded values used as linear' : 'Decoded before lighting';
  $('right-subtitle').textContent = isRoughness ? 'Original material values preserved' : 'Decoded before lighting';
  $('left-value-label').textContent = $('right-value-label').textContent = isRoughness ? 'Material roughness' : 'Linear input';
  if (!preserveSamples || !selectedMaterial || isRoughness) {
    $('left-value').textContent = isRoughness ? format(wrongRoughness) : rgb(isSingle && state.decode ? decoded : encoded);
    $('right-value').textContent = isRoughness ? format(rawRoughness) : rgb(decoded);
  }
  $('stored-title').textContent = isRoughness ? 'Roughness Texture' : 'Base Color Texture';
  if (!preserveSamples || !selectedMaterial || isRoughness) {
    $('stored-value').textContent = isRoughness ? `${state.roughnessPixel} / 255 = ${format(rawRoughness)}` : rgb(encoded);
  }
  $('stored-note').textContent = isRoughness ? 'Green channel · numeric material data' : selectedMaterial ? 'Center texture sample · filtered RGB' : '8-bit RGB normalized by 255';
  $('interpretation-title').textContent = isRoughness ? 'Read as Data' : 'sRGB Decode';
  $('linear-note').textContent = isRoughness ? 'Roughness entering the material' : 'Linear RGB entering the material';
  $('lighting-connector').textContent = isRoughness ? 'Material roughness → PBR lighting' : 'PBR lighting';
  if (isRoughness) {
    values('decode-state', [state.roughnessDecode ? 'sRGB DECODE' : 'DATA', 'DATA'], [wrong ? 'wrong-text' : 'correct-text', 'correct-text']);
    values('linear-values', [format(wrongRoughness), format(rawRoughness)]);
  } else if (isSingle) {
    values('decode-state', [state.decode ? 'APPLIED' : 'BYPASSED'], [wrong ? 'wrong-text' : 'correct-text']);
    if (!selectedMaterial || !preserveSamples) values('linear-values', [rgb(state.decode ? decoded : encoded)]);
  } else {
    values('decode-state', ['BYPASSED', 'APPLIED'], ['wrong-text', 'correct-text']);
    if (!selectedMaterial || !preserveSamples) values('linear-values', [rgb(encoded), rgb(decoded)]);
  }
  if (selectedMaterial && !isRoughness && !preserveSamples) {
    const pending = sampleTarget ? '…' : 'Unavailable';
    $('stored-value').textContent = $('left-value').textContent = $('right-value').textContent = pending;
    values('linear-values', activeMaterials().map(() => pending));
  }
  if (!preserveSamples) {
    values('scene-values', activeMaterials().map(() => sampleTarget ? '…' : 'Unavailable'));
    values('display-values', activeMaterials().map(() => sampleTarget ? '…' : 'Unavailable'));
  }
  $('pipeline-message').className = `pipeline-message ${wrong ? 'warning' : 'success'}`;
  $('pipeline-message').textContent = isRoughness
    ? state.roughnessDecode
      ? `⚠ Roughness is data, not color. sRGB decoding changed the intended value: ${format(rawRoughness)} → ${format(wrongRoughness)}.`
      : '✓ Both objects read roughness as numeric data. Their materials now match.'
    : wrong
      ? `⚠ Base Color${isSingle ? '' : ' on the left'} is being interpreted as linear data.`
      : '✓ Base Color is decoded into linear RGB before lighting.';
  requestRender();
}

document.querySelectorAll('[data-stage]').forEach((tab) => tab.addEventListener('click', () => {
  state.stage = tab.dataset.stage;
  update();
}));
$('light-intensity').addEventListener('input', (event) => { state.light = Number(event.target.value); update({ preserveSamples: true }); });
function assignColorMaps(materialSet) {
  const maps = materialSet?.maps;
  for (const material of [colorMaterial, wrongColorMaterial]) {
    material.map = maps ? (material === colorMaterial ? maps.Color : materialSet.undecoded) : material === colorMaterial ? encodedTexture : undecodedTexture;
    material.roughnessMap = maps?.Roughness ?? null;
    material.normalMap = maps?.NormalGL ?? null;
    material.metalnessMap = maps?.Metalness ?? null;
    material.aoMap = maps?.AmbientOcclusion ?? null;
    material.roughness = maps ? 1 : 0.5;
    material.metalness = maps?.Metalness ? 1 : 0;
    material.needsUpdate = true;
  }
}
let textureRequest = 0;
$('texture-select').addEventListener('change', async (event) => {
  const selection = event.target.value;
  const request = ++textureRequest;
  $('texture-select').disabled = true;
  $('texture-bytes').textContent = 'Loading local material…';
  try {
    const loaded = presets[selection] ? null : await loadMaterial(selection, Math.min(renderer?.capabilities.getMaxAnisotropy() ?? 1, 4));
    if (request !== textureRequest) return;
    selectedMaterial = loaded;
    state.texture = selection;
    assignColorMaps(loaded);
    update();
  } catch (error) {
    if (request !== textureRequest) return;
    $('texture-select').value = state.texture;
    $('texture-bytes').textContent = 'Could not load material. Try again.';
    console.error(error);
  } finally {
    if (request === textureRequest) $('texture-select').disabled = false;
  }
});
$('roughness-pixel').addEventListener('input', (event) => { state.roughnessPixel = Number(event.target.value); update({ preserveSamples: true }); });
$('decode-toggle').addEventListener('change', (event) => { state.decode = event.target.checked; update(); });
$('roughness-decode-toggle').addEventListener('change', (event) => { state.roughnessDecode = event.target.checked; update(); });
$('reset-button').addEventListener('click', () => {
  textureRequest++;
  selectedMaterial = null;
  assignColorMaps(null);
  $('texture-select').disabled = false;
  Object.assign(state, { light: 2, texture: 'gray', decode: true, roughnessDecode: true, roughnessPixel: 128 });
  $('light-intensity').value = state.light;
  $('texture-select').value = state.texture;
  $('roughness-pixel').value = state.roughnessPixel;
  update();
});

const mathCopy = {
  en: String.raw`
    <h3>1. Decode encoded color before lighting</h3>
    <p>The experiment uses the exact sRGB transfer function. For a normalized encoded channel $c_s$:</p>
    <p>$$c_l = \begin{cases}c_s/12.92 & c_s \le 0.04045 \\ ((c_s+0.055)/1.055)^{2.4} & c_s > 0.04045\end{cases}$$</p>
    <p>A hypothetical $c_s=0.5$ decodes to $c_l\approx0.214041$. The neutral gray preset stores 128, so $c_s=128/255\approx0.501961$ and $c_l\approx0.215861$. Skipping decoding sends $0.501961$ into lighting, about $2.325$ times the intended input.</p>
    <p>For the downloaded ambientCG materials, texture and linear input values are sampled by the GPU at the same marked center pixel as the lighting result. The correct color sampler decodes before filtering; the incorrect sampler filters encoded values directly. Both materials share roughness, normal, metalness, and AO maps, where available. Displacement is disabled so the geometry stays identical.</p>
    <h3>2. Light in a linear working space</h3>
    <p>A simplified diffuse term is $L_o=(\rho/\pi)L_i\max(0,\mathbf n\cdot\mathbf l)$. The actual spheres use Three.js physical shading, including specular reflection and a shared neutral environment. Both receive exactly the same lighting. The slider scales the directional light and environment together.</p>
    <p>The displayed scene values are RGB readbacks of the marked center pixel from a floating-point render target, before output encoding. They are actual shader results, rather than a diffuse-only estimate.</p>
    <h3>3. Encode the output for display</h3>
    <p>We use no tone mapping, an identity tone transform, so the final stage applies the sRGB output transfer and clamps to the display range:</p>
    <p>$$c_s = \begin{cases}12.92c_l & c_l \le 0.0031308 \\ 1.055c_l^{1/2.4}-0.055 & c_l > 0.0031308\end{cases}$$</p>
    <p>The pipeline's display bytes are computed from the sampled linear pixel using this function and rounded to 8 bits. Hardware rounding and antialiasing can differ by one byte.</p>
    <h3>4. Roughness pixels represent numbers</h3>
    <p>A roughness pixel of 128 means $r=128/255\approx0.502$. Applying the color transfer incorrectly produces $r\approx0.216$, making the material smoother. The wrong material explicitly applies the transfer in its roughness shader. Turning it off makes both sides identical. The maps share the same stored bytes and the same material parameters.</p>
    <pre><code class="language-js">// Color map: decode encoded color.
baseColorTexture.colorSpace = THREE.SRGBColorSpace;

// Roughness map: preserve numerical material data.
roughnessTexture.colorSpace = THREE.NoColorSpace;

// Display: encode linear shading results as sRGB.
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;</code></pre>
    <p>sRGB is an encoded color representation commonly used for images and displays. Linear RGB supports lighting arithmetic. Data maps describe material parameters and receive no color transfer.</p>
    <p><a href="https://threejs.org/docs/pages/MeshStandardMaterial.html" target="_blank" rel="noopener noreferrer">Three.js material and texture documentation ↗</a></p>`,
  zhTW: String.raw`
    <h3>1. 色彩資料必須先解碼，再計算光照</h3>
    <p>本實驗使用完整的 sRGB 轉換函數。將編碼後的色彩通道正規化為 $c_s$，得到線性值：</p>
    <p>$$c_l = \begin{cases}c_s/12.92 & c_s \le 0.04045 \\ ((c_s+0.055)/1.055)^{2.4} & c_s > 0.04045\end{cases}$$</p>
    <p>假設 $c_s=0.5$，解碼結果為 $c_l\approx0.214041$。中性灰預設貼圖儲存 128，因此 $c_s=128/255\approx0.501961$，解碼後為 $c_l\approx0.215861$。省略解碼就會把 $0.501961$ 直接送入光照計算，大約是原本預期輸入的 $2.325$ 倍。</p>
    <p>選用下載的 ambientCG 材質時，貼圖與線性輸入值會由 GPU 在球體中心標記位置取樣，與光照結果對應同一像素。正確的色彩取樣器會先解碼再濾波，錯誤取樣器則直接對編碼值濾波。兩側會共用該材質提供的粗糙度、法線、金屬度與環境遮蔽貼圖；位移貼圖不啟用，因此兩側幾何完全相同。</p>
    <h3>2. 在線性工作空間計算光照</h3>
    <p>簡化的漫反射項可寫成 $L_o=(\rho/\pi)L_i\max(0,\mathbf n\cdot\mathbf l)$。畫面中的球體實際使用 Three.js 的物理材質，包含鏡面反射與共用的中性環境光。兩側的光照完全相同，滑桿會一起調整方向光與環境光。</p>
    <p>流程中的場景 RGB 數值，是從浮點渲染目標讀回球體中心標記位置的像素，取樣時間在顯示編碼之前。這些是 shader 的實際輸出，而非僅以漫反射公式估算的數字。</p>
    <h3>3. 將結果編碼成顯示用色彩</h3>
    <p>本實驗停用色調映射，使用恆等變換，因此最後一步只套用 sRGB 輸出轉換，並限制在螢幕可顯示的範圍：</p>
    <p>$$c_s = \begin{cases}12.92c_l & c_l \le 0.0031308 \\ 1.055c_l^{1/2.4}-0.055 & c_l > 0.0031308\end{cases}$$</p>
    <p>流程中的顯示位元組，使用此函數將取樣到的線性像素轉成 8 位元數值。硬體四捨五入與反鋸齒可能造成一個位元組的差異。</p>
    <h3>4. 粗糙度貼圖的像素代表數值</h3>
    <p>粗糙度像素 128 代表 $r=128/255\approx0.502$。若誤套色彩解碼，就會變成 $r\approx0.216$，讓表面更光滑。錯誤材質會在粗糙度 shader 明確套用轉換；關閉這個轉換後，兩側材質就會相同。兩側貼圖共用原始位元組，其他材質參數也完全一致。</p>
    <pre><code class="language-js">// Color map: decode encoded color.
baseColorTexture.colorSpace = THREE.SRGBColorSpace;

// Roughness map: preserve numerical material data.
roughnessTexture.colorSpace = THREE.NoColorSpace;

// Display: encode linear shading results as sRGB.
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;</code></pre>
    <p>sRGB 是常見於影像與顯示資料的色彩編碼表示；線性 RGB 適合光照與物理運算。資料貼圖描述材質參數，應保留原本的數值，不套用色彩轉換。</p>
    <p><a href="https://threejs.org/docs/pages/MeshStandardMaterial.html" target="_blank" rel="noopener noreferrer">Three.js 材質與貼圖文件 ↗</a></p>`,
};
let modalLanguage = 'en';
function renderMath() {
  $('math-content').innerHTML = mathCopy[modalLanguage];
  $('math-content').lang = modalLanguage === 'en' ? 'en' : 'zh-TW';
  renderMathInElement($('math-content'), { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false });
  Prism.highlightAllUnder($('math-content'));
}
$('open-math').addEventListener('click', () => { renderMath(); $('math-modal').showModal(); });
$('close-math').addEventListener('click', () => $('math-modal').close());
$('language-toggle').addEventListener('click', () => { modalLanguage = modalLanguage === 'en' ? 'zhTW' : 'en'; renderMath(); });
$('math-modal').addEventListener('click', (event) => {
  if (event.target !== $('math-modal')) return;
  const { left, right, top, bottom } = $('math-modal').getBoundingClientRect();
  if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) $('math-modal').close();
});

try {
  setupRenderer();
} catch (error) {
  renderer = undefined;
  $('render-error').textContent = 'WebGL 2 is unavailable. Enable hardware acceleration or open this experiment in a browser with WebGL 2 support.';
  $('render-error').hidden = false;
  document.querySelector('.live-status').textContent = 'Renderer unavailable';
  console.error(error);
}
update();
