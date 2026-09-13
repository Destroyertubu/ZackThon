# Star-tree garden furniture assets

The scene uses local files only. All newly downloaded source assets below are
published by Poly Haven under **CC0 1.0**. Attribution is retained for provenance.

| Asset | Author | Source | Local use |
| --- | --- | --- | --- |
| Wooden Stool 01 | Kuutti Siitonen | https://polyhaven.com/a/wooden_stool_01 | `bar-stool.glb`; real wood scan, with legs elongated below the seat and a separate upholstered cushion |
| Brass Goblets | Tina | https://polyhaven.com/a/brass_goblets | `brass-goblet.glb`; only goblet 01 retained, other objects and materials removed |
| Poly Wool Herringbone | Rico Cilliers / colormass | https://polyhaven.com/a/poly_wool_herringbone | 1K diffuse, OpenGL normal and roughness maps for the draped throw and cushions |

License: https://polyhaven.com/license

CC0 legal text: https://creativecommons.org/publicdomain/zero/1.0/

`SOURCES.json` records the official API URLs, original source byte counts and MD5
checksums. Every downloaded file was checked against its source checksum before
processing. `OUTPUT.json` records the selected model nodes, runtime byte counts
and triangle counts.

The stool source has 10,946 triangles. Its lower leg vertices were stretched in
Blender while preserving the original seat thickness, then exported as one
ordinary GLB without a compression decoder. The first brass goblet has 3,072
triangles; the unused two goblets and their textures are absent from the runtime
file. The full source packages remain in the temporary preparation cache, outside
`public/`.

The cabinet, cut-crystal vessels, crescent seat, woven hanging chair, tray and
cloth/fringe geometry are authored in the project. Existing Poly Haven book,
notebook, plant and storm-lantern scans are reused from the local `Assets.tsx`
registry. The knowledge ingredient colors and IDs come from `gardenRecipes.ts`.
