# Star garden: reference details

The files in this directory are real **CC0-1.0** Poly Haven models and an ambientCG photographed ivy atlas. No paid generation or purchased assets were used. Official asset and license pages were checked on 2026-09-13.

| Runtime file | Original asset / artist | Preparation | Bytes |
| --- | --- | --- | ---: |
| `moss-rocks.glb` | [Rock Moss Set 01](https://polyhaven.com/a/rock_moss_set_01), Kless Gyzen | Original rocks 01, 03, 06; 2,200 / 2,200 / 2,199 triangles; 1K PBR retained | 638,352 |
| `periwinkle.glb` | [Periwinkle Plant](https://polyhaven.com/a/periwinkle_plant), Amal Kumar | Original variants 05 and 06; all original leaf/flower geometry and UVs retained; official opacity packed into RGBA | 2,002,444 |
| `brass-lantern.glb` | [Brass Diya Lantern](https://polyhaven.com/a/brass_diya_lantern), Bhargav Kubal | Body optimized to 4,100 triangles; 588-triangle carrying loop retained; long suspension chain omitted; 1K brass/glass/flame PBR | 3,165,132 |
| `ivy/ivy-{color,opacity,normal}.jpg` | [Leaf Set 029](https://ambientcg.com/view?id=LeafSet029), ambientCG / Lennart Demes | Exact official 1K color, opacity and OpenGL normal maps; six photographed green leaves selected with atlas UVs | 1,174,097 |

**Total new runtime asset download: 6,980,025 bytes (6.98 MB).** GLBs embed their textures and require no geometry decoder. Ivy uses three shared JPGs. Source files, published Poly Haven MD5s, and ivy SHA256s are listed in `asset-report.json`; source downloads are cached outside `public/`.

Poly Haven's [official license](https://polyhaven.com/license) permits commercial use, modification, and redistribution under [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/). The original website previews are not redistributed here.

ambientCG's [official license](https://docs.ambientcg.com/license/) likewise releases these assets under CC0. Leaf Set 029 was captured with photometric stereo and covers a 25 × 25 cm atlas. Its [official 1K JPG ZIP](https://ambientcg.com/get?file=LeafSet029_1K-JPG.zip) is publicly downloadable without an account; the verified ZIP is 4,001,320 bytes. Credit is optional under CC0; the source is retained here for traceability.

## Scene integration

`src/components/observatory/GardenDetails.tsx` exports:

```tsx
import { GardenDetails, DetailedGardenLantern } from './GardenDetails'
import { GARDEN_DETAIL_OBSTACLES } from './gardenDetailLayout'

<GardenDetails />
<DetailedGardenLantern position={[x, y, z]} height={0.47} rotation={0} lightIntensity={0.65} />
```

The lantern is a separate replacement component. `GardenDetails` does not add a ring of lights. Lantern height includes its small carrying loop; its base is at the supplied Y coordinate. Set `lightIntensity={0}` where the scene already supplies lighting.

Navigation code should import `GARDEN_DETAIL_OBSTACLES` directly from `gardenDetailLayout.ts`, which contains only coordinates and has no React/Three.js dependencies. The same file exports `READING_CORNER_POSITION = [6.6, 0, 1.7]` and `READING_CHAIR_ROTATION = -0.8`, used directly by the chair/rug group. Return-door foliage uses `RETURN_GATE_POSITION` and rotation -0.25, with jamb centres at local X ±0.80 and an arched crown at Y 2.47–2.60 around the 1.5 m-wide, 2.45 m-high timber door. Jamb leaves point outward to preserve its central opening.

The detail component includes 12 stone shelves inside existing planters, 16 blue-violet flower clumps, dense ivy on the pergola and return-door jambs, and a single reading armchair with a woven circular rug. The photographed periwinkle's pink petals are shifted to blue-violet in this component's material shader; the original atlas, pale flower centres, veins, and transparency remain intact. A small blue emission affects only petal pixels, leaving foliage dark. The ten tree-bed clumps stand 0.85–1.0 m high with centres 1.40–1.58 m from the trunk, keeping their wider foliage inside the existing 2.12 m planting bed. The optional `periwinkle_trailing_sprig` node remains in the model for reuse but is no longer rendered on beams or doors.

`GardenIvy.tsx` uses **1,490 real ivy leaf cards**, arranged in six instanced batches. Each card has four triangles and a gentle central crease. `gardenIvyGeometry.ts` deterministically grows them along curved timber-hugging vines with two overlapping beam ribbons, alternating leaves on posts, and nine short hanging tendrils. The photographed alpha silhouette and veins stay intact; no atlas pixels are generated or repainted. Leaves use the first two rows of the source atlas, avoiding the yellow lower-row leaves. The 5,170-triangle vine geometry plus 5,960-triangle foliage totals **11,130 triangles**.

The armchair reuses the cabin's existing Poly Haven `ArmChair_01` model and the rug reuses its CC0 `fabric_pattern_07` roughness/normal textures. Those existing files are not duplicated. The rug's concentric raised braids and fringe are local geometry.

### Budget and collision

- Base `GardenDetails`: **99,552 rendered triangles**, counting instances and reused armchair.
- Optional lantern: **4,688 triangles per instance**.
- With eight replacement lanterns: **137,056 triangles**, below the 200,000-triangle allocation.
- New collision footprint: `{ x: 6.6, z: 1.7, radius: 0.67 }` for the reading chair.
- All stones are inside current planter footprints. The rug is 2 cm above the deck and remains walkable. Hanging foliage follows existing posts and door jambs; it does not block the gateway's picture or label.

The report contains per-node dimensions, triangle counts, scene instance counts, and the footprint. Models are Y-up and individually bottom-centred; the three rock nodes and two plant nodes are alternatives, so consumers should select named nodes instead of rendering each whole scene in one location.

## Reproduce

```sh
python3 scripts/prepare-garden-details.py
```

This checks each downloaded model file against Poly Haven's published MD5, uses Blender for UV/material-aware rock and lantern simplification, restores official plant/glass opacity, exports the three final GLBs, calls `prepare-garden-ivy.py` for the official ivy textures, and rewrites the complete report and budgets. The report compiles the actual TypeScript ivy geometry with the project's installed esbuild and measures the resulting leaf/branch counts. Override `BLENDER_BIN` and `GARDEN_DETAILS_CACHE` if necessary. Default cache: `/tmp/wanderwise-garden-details-source`.

To refresh only ivy assets, run `python3 scripts/prepare-garden-ivy.py`. To refresh budget/source reports without Blender or model downloads, run `python3 scripts/prepare-garden-details.py --report-only`.

Periwinkle uses `alphaTest=0.3`, `DoubleSide`, and roughness 0.94. Ivy uses `alphaTest=0.48`, `DoubleSide`, roughness 0.95, and subdued normal/environment response to retain dark green leaves under the observatory lamps. Lantern flames retain warm emission at intensity 1.5 with tone mapping enabled, preserving the visible metal housing. Cached source materials are never modified by the detail component.
