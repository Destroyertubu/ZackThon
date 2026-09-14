# Mirror Sea scene contract

`JourneyWorld.tsx` and `LandWorld.tsx` default and named exports are lazy-loadable full Canvas components. Mount them in a positioned, non-zero-size container. `index.ts` also exports `preloadJourneyAssets()` to warm the shared texture cache.

- `realmDefinitions.ts` maps all 10 unordered pairs of the five real garden recipe ingredient IDs to stable English route IDs. Ratios do not change a realm ID.
- `initialPose.position` is eye position; station and surface coordinates are floor positions. Eye height is 1.7 m. A bad/outside/obstructed saved pose returns to the spawn.
- `onPose` is throttled to 0.2 seconds and flushes on pause/unmount. It never writes storage itself.
- `onNearStation(station|null)` changes at proximity transitions (3.1 m), and `onInteract(stationId)` fires for a non-repeated E key near that station. Page UI owns articles, tasks, route actions, saving and feedback.
- `disabled` clears all held keys/touches, releases pointer lock, stops movement and mouse look. Ambient water, sky and foliage continue while reading, using the same Canvas; reduced motion freezes their animation. Closing reading rebinds natural mouse hover; no additional click is required.
- WASD/arrows walk; Shift increases speed; C returns to the current entrance. Touch drag looks around; the separate direction pad supports multiple pointers and releases on cancel/blur/unmount.
- `onCaptureReady` registers a synchronous `() => string` JPEG capture of the actual current camera. It explicitly renders immediately before `toDataURL`; errors are thrown to the caller to report. Unmount registers null. Never substitute an invented image.
- `onReady` fires once when the main materials/geometry and any hero tree have reached their first rendered frame. Background texture loading has a separate Suspense boundary.
- `JourneyWorld` additionally accepts `firstPercent` and `primaryKnowledge`. Pass the original recipe percentage and its first ingredient; the scene resolves canonical pair order. The recipe contributes only 10% to the main-light colour, maintaining the authored world palette and geometry.
- Auto/fine enable one 1024 shadow map; smooth disables shadows and keeps lit surfaces, visible physical lamps and GPU particle glow. Reduced motion freezes leaf wind, rain, particles and the shared water/sky animations while preserving walking.

## Rendering and resources

Near-scene construction batches by material, currently 6–18 meshes, approximately 46k–288k procedural triangles per realm (land about 93k). The two ancient-tree worlds add one shared 438,168-triangle Jacaranda asset; geometry, UVs and leaf-alpha pixels are unchanged from the observatory source. The dedicated journey asset is 6,627,960 bytes. Shared WebP maps preserve 1K wood/bark/mineral normals and use lossless alpha where needed. Home and observatory retain their original texture paths through `compactTextures=false`.

The asset audit measures cold body payload (before HTTP compression and excluding code) at 4,624,502 bytes for a daytime world, 4,947,548 for night, and 11,503,338 for a hero-tree daytime world including local Draco decoder. Texture caches are intentionally shared across revisits; all per-mount geometries, materials, texture clones, controls and DOM listeners are released. The original cabin, observatory, galaxy and personal data stores are not written by these scene modules.

`FrameDiagnostics` writes `canvas.dataset.worldFps`, `worldTriangles`, `worldDrawCalls`, `worldTextures`, `worldGeometries` every two visible seconds. It adds no UI, networking or storage. Read after a stable rendered interval; paused/demand frames are not an animation FPS sample.

## Verification

Run `node src/features/journeys/scene/test-world-navigation.mjs`. It compiles the actual definitions/navigation/builders with esbuild and checks all pair mappings, all 55 reachable stations, bad-pose recovery, obstacle centres and every generated vertex/normal/UV/index. Physical seating explicitly opens at connecting bridges. Random island bevels stay outside the contracted walkable top. Controller integration was independently exercised with the real bindSceneLook and collision helper, including pause/resume, touch sources, cleanup and screenshot call order.

Sources, public-domain museum images and asset processing are documented in `assets/SOURCES.md`, `public/models/garden/journey-textures/` and the garden asset audit. Gallery paintings are curated public works, not visitor collections.
