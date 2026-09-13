# Star Tree Garden assets

These are local runtime derivatives of free **CC0** Poly Haven assets. No paid
generation service, subscription, or commercial asset pack was used.

| Runtime asset | Source / author | Triangles | File size | Bounding box X × Y × Z |
| --- | --- | ---: | ---: | --- |
| `tree-small-02-cards.glb` | [Tree Small 02](https://polyhaven.com/a/tree_small_02), Rico Cilliers | 190,999 | 16,202,124 bytes | 3.779 × 4.557 × 5.571 m |
| `fern-02.glb` | [Fern 02](https://polyhaven.com/a/fern_02), Rico Cilliers and Rob Tuytel | 2,248 | 1,859,992 bytes | 0.874 × 0.349 × 0.765 m |
| `flowers.glb` | [Flower Heliophila](https://polyhaven.com/a/flower_heliophila), Jenelle van Heerden | 17,593 | 2,683,668 bytes | 0.343 × 0.270 × 0.274 m |

Total deployed model data: **20,745,784 bytes (19.78 MiB)**. All textures are
embedded; there are no remote runtime requests and no Draco or Meshopt decoder
dependency. Original 1K base color, normal and packed roughness/metalness maps
remain in the GLBs. The tree's second UV set and branch texture transforms remain.

## Placement and node names

All assets use glTF Y-up, X/Z-centered whole-object bounds, and bottom Y=0.
Positions in individual node geometries are not themselves centered; use the
whole loaded scene or preserve the node's exported translation.

- Tree: `star_tree_trunk`, `star_tree_branches`, `star_tree_leaves`. The crown's
  long axis is Z. Scale the whole scene by `7 / 4.556865` for a seven-meter tree.
- Fern: only `fern_02_c` is retained from the original four-plant set.
- Flowers: only `flower_heliophila_small` is retained from the three-clump set.

## Processing

The source tree glTF has 2,062,487 triangles. The mature-tree revision retains
100% of its complete connected leaf islands before material-separated decimation.
The crown's horizontal spread is increased to 1.3× by moving each leaf island's
center, leaving individual blade sizes and UVs intact. Trunk and branch surfaces
are thickened with a 1.45× local-diameter target, estimated by inward surface rays;
the lower root cut is kept seated. Crown widening follows a smooth vertical
profile, so forks and branches stay continuous. Height remains 4.556865 m.

The final runtime uses **30,250 lightly curved leaf cards, four triangles each**,
rebuilt from the original UV islands. Each card follows the island's rotated UV
axes; curvature comes from observed surface offsets, with bounded interpolation
instead of polynomial extrapolation. Original UV coordinates and the real alpha
atlas preserve the complete leaf silhouettes. This fixes the lost leaf coverage
caused by collapsing tiny high-curvature meshes: sampled alpha-covered area rises
from approximately 17.34 m² to 27.76 m², close to the source leaf surface area of
27.81 m². These are native-model-space area estimates using seven samples per
triangle at alpha cutoff 0.30, rather than a rendered screen-coverage measure.

Final counts are 45,000 branch, 121,000 leaf and 24,999 trunk triangles, below the
220,000-triangle limit. Trunk/branch attributes, indices and every node transform
are byte-identical to the mature reference; the whole-model bounds are identical,
so attachment points stay valid. Full processing parameters are saved in
`scripts/garden-asset-options.json` in the app workspace.

The official JPG-based glTF files reference diffuse images without an alpha
channel. The preparation script additionally downloads the official alpha PNG
maps and combines them with diffuse RGB during Blender export. Final leaves,
ferns and flowers use **RGBA + `alphaMode: MASK`, double-sided** materials. The
tree's cutoff is 0.30 to preserve fine leaves; fern and flower cutoffs are 0.38.
The alpha maps are non-color data. Normals and packed material maps
are preserved; the models are not emissive.

Download sources were checked against Poly Haven's provided MD5 hashes. Exported
GLB containers, all embedded buffer/image bounds, required triangle budgets and
RGBA alpha ranges were checked. The tree was reimported and visually inspected
with offline Blender renders: `artifacts/garden-assets/tree-preview.png` records
the first sparse version, `tree-preview-mature.png` records the widened mesh tree,
and `tree-preview-cards.png` records the final tree with curved leaf cards.

## Trunk attachment coordinates

`tree-attachments.json` contains measured horizontal mesh intersections. Each
section lists the largest trunk loop first, followed by separate forks, with
local centers, approximate radii and scene-world coordinates. The root center is
measured 0.12 m above the uneven scan cut and projected to Y=0. Model height
sections are at 0, 1.5 and 2.5 m. Scene height sections are at 1.5, 2.5, 3.5 and
4.5 m using the saved seven-meter-tree position/rotation reference.

This matters because centering the tree's crown does not center its curved trunk.
Use these measured stem locations for hanging attachments; the current scene
hangs its nine lanterns directly from natural branches, without synthetic boughs.
`hanging-anchors.json` provides nine spaced attachment points sampled directly
from the real branch/trunk surfaces, with vertex indices and surface normals.

## Reproduce

Run `python3 scripts/prepare-garden-assets.py` from the app workspace. This entry
point downloads/verifies sources, prepares the mature trunk and branches,
automatically runs `prepare-garden-leaf-cards.py`, then archives the intermediate
mesh tree outside `public/`. To rebuild only leaf cards from the cached sources
and archived mature tree, run `python3 scripts/prepare-garden-leaf-cards.py`.
The scripts require
NumPy, SciPy and Blender. Defaults use the installed macOS Blender at
`/Applications/Blender.app/Contents/MacOS/Blender`; override with `BLENDER_BINARY`.
Original downloads and source manifests are cached outside the served assets at
`/tmp/wanderwise-garden-source` (override with `GARDEN_SOURCE_CACHE`).

`asset-report.json` lists the three final runtime assets. `leaf-card-report.json`
records exact card fit statistics, bounds, materials and attachment sections.
The comparison file `tree-small-02.glb` is archived at
`artifacts/garden-assets/tree-small-02.glb` as historical QA evidence and as the
geometry source for the leaf-card preparation script. It is not served at runtime.

## License

Poly Haven releases these source assets under **CC0 1.0 Universal**:

- [Poly Haven asset license](https://polyhaven.com/license)
- [CC0 1.0 Universal deed](https://creativecommons.org/publicdomain/zero/1.0/)
- [CC0 1.0 legal code](https://creativecommons.org/publicdomain/zero/1.0/legalcode)

The optimized geometry and texture-channel packing here are derivatives of
those public-domain assets. Credit is recorded for traceability and appreciation.
