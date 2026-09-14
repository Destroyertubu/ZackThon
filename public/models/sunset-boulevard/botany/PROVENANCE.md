# Sunset boulevard botany

Originals: [Tree Small 02](https://polyhaven.com/a/tree_small_02) and [Shrub 01](https://polyhaven.com/a/shrub_01), by **Rico Cilliers / Poly Haven**; [Fern 02](https://polyhaven.com/a/fern_02), by **Rico Cilliers and Rob Tuytel / Poly Haven**. All **CC0-1.0**.

`street-tree.glb` preserves all 190,999 source triangles and the original placement of its trunk, branches and leaves. All parts share one root translation. `rooted-shrub.glb` is one complete high-detail original plant (36,199 triangles); eight neighbouring plants were removed through empty spatial gaps. `fern.glb` preserves the existing complete `fern_02_c` plant and all 2,248 triangles; its native alpha cutoff of 0.38 remains. None of these plants was decimated. The official shrub alpha PNG was combined with its diffuse map before export.

All models use Draco geometry and native 1024×1024 WebP textures. RGB compression is lossy (quality 82–92); leaf alpha is pixel-exact. No animations, lights or cameras are exported. Coordinates are glTF Y-up, metres; the true low root lies at local `[0, 0, 0]`. Use the measured bounds and trunk clearance in `manifest.json`, not the canopy centre, for scene placement.

Editable, texture-packed Blender files and original shrub downloads are under `assets/source/sunset-botany/`. Rebuild with `python3 scripts/prepare-sunset-botany.py`; use `--only-fern` to rebuild just the fern while preserving existing tree/shrub files and manifest entries. Source downloads are checked against official MD5; `manifest.json` records all SHA-256/MD5 hashes, byte sizes, bounds, root measurements, mesh counts and processing choices. Fern's original local derivative provenance remains in `public/models/garden/README.md`.
