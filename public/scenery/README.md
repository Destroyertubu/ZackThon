# Balcony landscape assets

## Kiara valley panorama

- Asset: **Kiara 7 Late-Afternoon** by **Greg Zaal / Poly Haven**.
- Asset page: <https://polyhaven.com/a/kiara_7_late-afternoon>
- License: **CC0 1.0**, <https://polyhaven.com/license> and <https://creativecommons.org/publicdomain/zero/1.0/>.
- Original tonemapped JPEG: <https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/kiara_7_late-afternoon.jpg>.
- Local HDRI: `../textures/kiara_7_late-afternoon_1k.hdr`, downloaded from the Poly Haven 1K HDRI asset. SHA-256: `d17787e1e404b601e2ec5a2e5910aa739130ad25477d1da8220cec4ca7291eb5`.
- Original MD5 verified against Poly Haven's files API: `6550397ffb525b479643d513b4b7897c`.
- Local derivative: `kiara-valley-4k.jpg`, 4096 × 2048, Lanczos reduction of the original 8192 × 4096 image, JPEG quality 92 (2.35 MB). No AI generation, compositing, or watermark removal.
- Used as a full, inward-facing spherical panorama. The photographed sun faces the cabin's rear window. The image is included locally, so the scene has no runtime dependence on Poly Haven's network.

The pre-existing `public/mountain-view.jpg` has visible stock-image watermarks and no license record in this project. It is no longer used by `Backdrop.tsx`.

## Foreground

- Existing `public/textures/rock_face_*_1k.jpg`: **Rock Face**, Poly Haven CC0; <https://polyhaven.com/a/rock_face>. Color, OpenGL normal, and roughness maps shade the new slope and rocks.
- Existing `public/models/potted_plant_02/`: **Potted Plant 02**, Poly Haven CC0; <https://polyhaven.com/a/potted_plant_02>. Only its leaf mesh and material are instanced as small plants beside the ledge; the pot and soil meshes are not rendered.
- The slope, deformed rocks, and grass blades are project-authored geometry. Deterministic placement and shared/instanced geometry keep the scene stable and reduce draw calls.

The balcony is the walkable outside area. Foreground terrain is scenery below the deck, not an additional navigable map.
