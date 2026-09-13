# Mature Jacaranda star tree

The live tree is `jacaranda-mature.glb`. It replaces the former `tree-small-02-cards.glb` in `LivingStarTree.tsx`; the old file remains for historical reproducibility.

## Source and permission

- Asset: [Jacaranda Tree, Poly Haven](https://polyhaven.com/a/jacaranda_tree).
- Authors: Rico Cilliers (all), Rob Tuytel (guidance).
- Source metadata: `https://api.polyhaven.com/files/jacaranda_tree`.
- Asset license: [CC0](https://polyhaven.com/license). Poly Haven explicitly permits redistribution, adaptation and commercial use. Attribution is appreciated but is not a CC0 requirement.
- Downloaded from the public official asset URLs, without an account or subscription. Source files remain under `artifacts/garden-assets/jacaranda-source/`, outside the runtime asset directory. Downloads are verified against the official API MD5 values.
- The official GLTF LOD0 contains **3,863,832 triangles** (branches 1,231,286; trunk 230,112; leaves 2,402,434). The smaller number shown on the website is not used as the source measurement.

## Web preparation

`prepare-jacaranda.py` preserves all **116,084 connected UV leaf islands**. Ordinary leaf islands become two-triangle cards; the 18,000 most curved islands use four triangles. It preserves the original UV silhouettes and bends. No crown leaves are randomly discarded. Leaf total: **268,168 triangles**.

Blender 5.2.1 LTS decimates the branch and trunk surfaces separately while retaining native PBR UVs. Final geometry has **438,168 triangles**: branches 105,000, trunk 65,000, leaves 268,168. Draco compresses this topology without another decimation pass (position 14 bits, normals 10 bits, UV 14 bits). Final GLB size is **13,912,936 bytes**.

Trunk diffuse, normal and ARM textures retain **2048 × 2048** resolution; branches and leaves retain **1024 × 1024**. RGB JPEG maps use quality 93 and full chroma. The real leaf diffuse is combined with the separate official opacity map into a lossless RGBA PNG; material alpha mode is MASK, cutoff 0.3, double-sided. At runtime the final, post-texture roughness is clamped to 0.72 for bark and 0.82 for foliage.

The final canopy is 11.32975 m wide and 8.88975 m deep. The complete crown is shaped to 7.85 m tall, with a gentle 0.7 m upper left lean. The dominant low trunk is radially thickened by up to 1.72 around its measured centreline, with smooth height and distance falloffs. The upper crown spreads by 1.15 and shifts another 0.45 m left. Low outer growth is smoothly kept within 1.98 m radius. No additional runtime geometry copies or shape deformation are needed.

## Placement and attached lights

GLB coordinates are Y-up, final metre scale, root local Y = 0. Runtime placement is `[TREE_POSITION.x, 0.33, TREE_POSITION.z]`, rotation zero, scale one. The small lower-bound tolerance is buried in the flower-bed soil; the root does not float.

Checks on the **decoded final GLB**, rather than the pre-compression mesh:

- Height: 7.850094 m.
- Root radius below local Y = 0.1 m: **1.18513 m**.
- Wood radius below local Y = 1.65 m: **1.98218 m**. This remains inside the unchanged 2.12 m planter and its existing navigation obstacle.
- Nine hanging roots are measured downward-facing branch vertices. Maximum compression displacement from those roots: **0.475 mm**.
- Two golden shoots use 197 measured points on connected bark routes, bridging only very close scan/UV seam samples. Their offset from the bark is about 18 mm, measured maximum **18.174 mm**. They follow the real fork geometry instead of a synthetic curve through the open crotch.

`jacarandaMeasurements.json` in `src/components/observatory/` is the runtime source of these local measurements. `GARDEN_TREE_ANCHORS` and `GARDEN_TREE_VINE_PATHS` in `gardenTreeShape.ts` add the same root translation. The public `jacaranda-anchors.json` and `jacaranda-jewelry.json` are inspection copies. Do not apply the previous small-tree rotation or scale to any of them.

## Local decoder

`draco/` contains the glTF-compatible Draco decoder bundled with Three.js 0.186.0. Draco is licensed under Apache 2.0; the unmodified license is included at `draco/LICENSE`. The dedicated GLTFLoader uses two workers and `/models/garden/draco/`; it does not fetch a decoder from a CDN. Shared model geometry and textures stay owned by the loader cache; the component disposes only its cloned materials. Reduced-motion pauses leaf motion.

## Reproduce and verify

From the app directory:

```sh
python3 scripts/prepare-jacaranda.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/prepare-jacaranda.py -- --blender
python3 scripts/prepare-jacaranda.py --finalize
node scripts/test-jacaranda-model.mjs
```

The first step needs Python NumPy, SciPy and Pillow, and downloads official source assets using the saved API metadata. The Blender step optimizes, exports, measures the attachments, and renders `artifacts/garden-assets/jacaranda-web-preview.png`. The final step packages local decoders and optimized RGB textures. The last command actually decodes all Draco primitives and checks triangle counts, retained foliage, opacity, finite attributes, height, root/low-wood bounds, and lamp/vine placement.
