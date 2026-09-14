# Journey resource variants

These local variants are for the journey scenes. Their source assets remain untouched for the cabin and observatory. `url-mapping.json` lists each original URL, replacement URL, byte count and dimensions.

## Sources

- [Wood Floor Deck](https://polyhaven.com/a/wood_floor_deck), Dimitrios Savva; [Wood Table 001](https://polyhaven.com/a/wood_table_001), Dimitrios Savva / Rico Cilliers; [Rock Face](https://polyhaven.com/a/rock_face); [Plastered Wall 04](https://polyhaven.com/a/plastered_wall_04): existing Poly Haven textures, [CC0](https://polyhaven.com/license).
- Jacaranda bark and leaf atlas: [Jacaranda Tree](https://polyhaven.com/a/jacaranda_tree), Rico Cilliers / Rob Tuytel, CC0. Full source and geometry preparation: `../JACARANDA.md`.
- Ivy atlas: [LeafSet029](https://ambientcg.com/view?id=LeafSet029), ambientCG / Lennart Demes, CC0. Original local source: `../details/ivy/`.
- Star map: [Deep Star Maps 2020](https://svs.gsfc.nasa.gov/4851/), NASA/Goddard Space Flight Center Scientific Visualization Studio, Ernie Wright. See `public/scenery/star-garden/SOURCE.md` for NASA's reuse and acknowledgement record. This is a derivative decorative sky, not a planetarium pointing solution.

No downloads, accounts, paid services or new licenses were needed for this preparation. The listed asset and license pages were verified during source preparation; Wood Floor Deck, Wood Table 001, Plastered Wall 04 and the Poly Haven license were checked again on 2026-09-13.

## Texture changes

Shared wood, rock, plaster, ivy and small-tree textures retain their 1024-pixel dimensions. RGB maps use WebP quality 85. Jacaranda RGBA and the ivy opacity map use **lossless WebP**, with exact decoded pixel equality asserted by the preparation script. The NASA panorama uses 2048-pixel maximum dimension; the procedural point stars remain responsible for small, bright stars at runtime. Sandstone, gallery artworks and the environment HDR are unchanged.

## Hero tree

`../jacaranda-journey.glb` is **6,627,960 bytes**, down from 13,912,936 bytes. All **438,168 triangles**, node transforms, accessors, material settings and UVs remain unchanged. Every Draco geometry buffer is byte-identical to `jacaranda-mature.glb`; all 116,084 leaf islands remain present.

Embedded diffuse and trunk normal maps retain 1024 pixels; branch/leaf normal and ARM maps use 512 pixels. The original observatory trunk maps were 2048 pixels, so extreme bark close-ups have less microdetail in this version. The 1024-pixel RGBA leaf atlas is pixel-exact. The GLB uses `EXT_texture_webp`, supported by the project's Three.js GLTFLoader, plus the existing local Draco decoder at `/models/garden/draco/`. It does not request any CDN decoder or remote texture.

## Measured asset budget

Static cold-cache, unique-URL totals, including the complete material arrays, backdrop textures, HDR and required Draco WASM/wrapper:

| Route type | Bytes |
| --- | ---: |
| Daytime with hero tree, before | 23,581,101 |
| Daytime with hero tree, optimized | **11,503,338** |
| Daytime without hero tree | 4,624,502 |
| Nighttime without hero tree | 4,947,548 |

This is the **scene asset** budget, not total page transfer: application JavaScript, CSS, fonts, API responses and other previously visited routes are excluded. HTTP compression/cache can change wire transfer. Network validation after runtime URL integration remains the final check.

## Reproduce and verify

From the app root:

```sh
python3 scripts/prepare-journey-assets.py
node scripts/test-journey-assets.mjs
```

Python requires Pillow with WebP support. Reports are written to `artifacts/journey-assets/asset-report.json` and `budget-report.json`. The test actually decodes all Draco primitives, compares the compressed geometry byte-for-byte, checks the WebP containers and asserts the cold daytime scene assets stay below 12,000,000 bytes.
