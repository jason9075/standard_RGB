# ambientCG materials

Original 1024 × 1024 JPEG maps downloaded from ambientCG:

| Directory | Source | Maps |
| --- | --- | --- |
| `Wood051/` | https://ambientcg.com/a/Wood051 | Color, Roughness, NormalGL, Displacement |
| `Bricks059/` | https://ambientcg.com/a/Bricks059 | Color, Roughness, NormalGL, AmbientOcclusion, Displacement |
| `Metal036/` | https://ambientcg.com/a/Metal036 | Color, Roughness, NormalGL, Metalness, Displacement |

License: **Creative Commons CC0 1.0 Universal**.
Official terms: https://docs.ambientcg.com/license/
Full dedication: https://creativecommons.org/publicdomain/zero/1.0/

Files are unmodified extracts of the original `1K-JPG.zip` downloads.
Source links, download URLs, file sizes, and SHA-256 checksums are recorded in
`src/materials.json` at the repository root.

The experiment loads Color as sRGB and material data maps as NoColorSpace.
The deliberately incorrect color material shares the Color image and all other
maps, but skips sRGB decoding. Displacement maps are included for future use;
they are not enabled in the comparison, so its sphere geometry stays fixed.
