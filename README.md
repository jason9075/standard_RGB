# Standard RGB

An interactive Three.js experiment showing how texture interpretation affects
lighting and material appearance. Compare sRGB color decoding with linear data
handling, adjust the lighting, and inspect the values at each sphere's center
marker.

## Experiments

- **Color comparison:** Two spheres share the same geometry, camera, lighting,
  environment, material parameters, and texture images. The left sphere skips
  Base Color decoding; the right sphere decodes sRGB into linear RGB before
  lighting. Choose solid colors or local ambientCG materials.
- **Roughness reversal:** Both spheres share a numerical roughness map. Enable
  **Treat Roughness as sRGB** to apply an intentionally incorrect decode to the
  left sphere. Disable it to make both materials match. Adjust the roughness
  pixel from 0 to 255 to explore the effect.

**Light Intensity** scales the directional light and shared neutral environment
together. At zero, the spheres receive no illumination. **Reset experiment**,
above the description, restores the default settings for the current experiment.

The value panel shows texture input, interpreted material values, linear lighting
results, and display output. Linear scene values come from a floating-point GPU
readback at the center marker. Display output includes RGB bytes, a color swatch,
and a hex code computed with the sRGB output transfer. Tone mapping is disabled.
Hardware rounding and antialiasing may cause a one-byte difference from the
screen pixel. Devices without floating-point readback show unavailable values.

For the neutral gray texture, `128 / 255` is approximately `0.501961`, which
decodes to `0.215861`. An encoded value of exactly `0.5` decodes to approximately
`0.214041`.

Numeric fields retain their previous GPU sample until the next readback completes.
Fixed channel widths and reserved row heights keep the layout stable while
dragging sliders.

The interface is in English. The light bulb button opens a mathematical
explanation with English and Traditional Chinese content, KaTeX formulas, and
Prism.js code highlighting. The dialog supports Escape, backdrop clicks, and
native browser focus handling.

## Development

Use Node.js 22.12 or later. The Nix development shell provides Node.js 22, Bun,
and Just.

```sh
direnv allow
# Alternatively, enter the shell manually:
nix develop path:.

just install
just dev
```

Open <http://localhost:8080>.

Running `just` or `just default` lists available commands. Start the server with
`just dev`.

Without Nix or Just:

```sh
npm install --ignore-scripts
npm run dev
```

All dependencies are installed through npm and bundled locally. The application
uses no CDN imports, import maps, or remote texture requests.

On NixOS filesystems mounted with `noexec`, `scripts/fix-noexec.cjs` copies esbuild
and native Node modules into a private executable temporary directory and cleans
it up when the process exits. Installation uses `--ignore-scripts` to avoid
executing native binaries during dependency installation.

## Local materials

Three original ambientCG material sets are included as 1024 x 1024 JPEG maps:
14 textures totaling approximately 10.8 MB.

| Material | Source | Maps |
| --- | --- | --- |
| Wood051 | [Wood 051](https://ambientcg.com/a/Wood051) | Color, Roughness, NormalGL, Displacement |
| Bricks059 | [Bricks 059](https://ambientcg.com/a/Bricks059) | Color, Roughness, NormalGL, AmbientOcclusion, Displacement |
| Metal036 | [Metal 036](https://ambientcg.com/a/Metal036) | Color, Roughness, NormalGL, Metalness, Displacement |

Choose them from **Base Color Texture** in **Color comparison**. Color maps use
`THREE.SRGBColorSpace`; Roughness, NormalGL, Metalness, and AmbientOcclusion maps
use `THREE.NoColorSpace`. The intentionally incorrect material shares the same
images and data maps, but skips Base Color decoding. Displacement maps are
included for future use and are not applied to the spheres.

With downloaded materials, texture input and decoded input are sampled on the
GPU at the same center marker as the lighting result, including filtering.
The roughness experiment uses its adjustable grayscale data texture.

Files are stored in `public/textures/`. Source URLs, download URLs, file sizes,
and SHA-256 checksums are recorded in [src/materials.json](src/materials.json).
See [the texture documentation](public/textures/README.md) for asset details.
Texture URLs follow Vite's configured production base path.

Material settings follow the
[Three.js MeshStandardMaterial documentation](https://threejs.org/docs/pages/MeshStandardMaterial.html).

## Build and deploy

```sh
just build    # Build optimized assets into dist/
just preview  # Build and preview on localhost:8080
```

You can also run `npm run build` and `npm run preview`.

The production `base` in `vite.config.js` is `/standard_RGB/`, matching the
GitHub Pages site at <https://jason9075.github.io/standard_RGB/>. Update this path
if the repository is renamed. For deployment at a domain root, use `/`.

In your GitHub repository, select **Settings > Pages > Source > GitHub Actions**.
Push to `main` to trigger `.github/workflows/deploy.yml`, which installs
dependencies, builds the site, and deploys it to Pages. The workflow also supports
manual runs. Commit both `package-lock.json` and `flake.lock` for reproducible
dependency versions.

Run `just clean` to remove `dist/` and `node_modules/`.

## Project structure

```text
.
├── .envrc
├── .github/workflows/deploy.yml
├── .gitignore
├── flake.nix
├── flake.lock
├── Justfile
├── LICENSE
├── package.json
├── package-lock.json
├── vite.config.js
├── index.html
├── README.md
├── guidelines.md
├── scripts/fix-noexec.cjs
├── public/favicon.svg
├── public/textures/README.md
├── public/textures/{Wood051,Bricks059,Metal036}/
└── src/
    ├── main.js
    ├── color-math.js
    ├── materials.js
    ├── materials.json
    └── style.css
```

## License

Project source code is licensed under the [MIT License](LICENSE).

Copyright (c) 2026 jason9075 (Jason Kuan).

The included ambientCG textures are provided under
[Creative Commons CC0 1.0 Universal](https://docs.ambientcg.com/license/), as
documented in [public/textures/README.md](public/textures/README.md).
