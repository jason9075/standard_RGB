import * as THREE from 'three';
import materialCatalog from './materials.json';

export { materialCatalog };
const cache = new Map();
export function materialUrl(asset, map = 'Color') {
  return `${import.meta.env.BASE_URL}textures/${asset.id}/${asset.maps[map]}`;
}

export async function loadMaterial(id, anisotropy = 1) {
  if (cache.has(id)) return cache.get(id);
  const asset = materialCatalog.find((entry) => entry.id === id);
  if (!asset) throw new Error(`Unknown material: ${id}`);
  const loader = new THREE.TextureLoader();
  const textures = [];
  // Wait for all requests so even a failed load can dispose every loaded map.
  const results = await Promise.allSettled(
    ['Color', 'Roughness', 'NormalGL', 'Metalness', 'AmbientOcclusion']
      .filter((map) => asset.maps[map])
      .map(async (map) => {
        const texture = await loader.loadAsync(materialUrl(asset, map));
        textures.push(texture);
        texture.colorSpace = map === 'Color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.anisotropy = anisotropy;
        return [map, texture];
      }),
  );
  const failure = results.find((result) => result.status === 'rejected');
  if (failure) {
    textures.forEach((texture) => texture.dispose());
    throw failure.reason;
  }
  const maps = Object.fromEntries(results.map((result) => result.value));
  const undecoded = maps.Color.clone();
  undecoded.colorSpace = THREE.NoColorSpace;
  undecoded.needsUpdate = true;
  const material = { asset, maps, undecoded };
  cache.set(id, material);
  return material;
}

export function disposeMaterials() {
  for (const { maps, undecoded } of cache.values()) {
    Object.values(maps).forEach((texture) => texture.dispose());
    undecoded.dispose();
  }
  cache.clear();
}
