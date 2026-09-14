# Star Atelier implementation notes · 2026-09-14

This record covers the observatory and cabin update based on the approved star garden and cocktail bar direction.

## Implemented

- Replaced the former observatory bar fixture with a crescent walnut, brass, and pearl stone cocktail atelier.
- Added five distinct ingredient decanters and ten crafted cocktail presentations shared by the bar UI and the in-scene launch preview.
- Expanded the observatory into a richer star garden with arched timber structure, crescent moon water, a small rill, rooted opal petals, brass branches, and static modeled botanical dressing.
- Changed the moving botanical elements so the problematic floating or rotating plant cards are not used as the main foliage treatment.
- Separated cabin functions by physical object:
  - round table: synthesis desk for turning selected materials into a personal work;
  - display cabinet: collections and notes;
  - desk: journey journal;
  - armchair and bookshelf: reading resume and works;
  - phone booth: public author viewpoints from real source identities;
  - Liu Kanshan: mascot search, interests, and reading entrance.
- Added a canvas-only fixture activation guard so HTML panel clicks do not reopen or trigger 3D fixtures behind the interface.
- Kept immediate mouse look, touch controls, journey launch cancellation, automatic travel, and galaxy return behavior on the existing routes.

## Verification

- `npm run test:personal`: 70 tests passed.
- `npm run test:home`: connected floor, all 8 interactions, camera and architecture checks passed.
- `npm run test:observatory`: 18,979 connected observatory samples, 15 round trips, fixtures, home door, and galaxy passage passed.
- `npm run test:garden`: 85 recipe and storage cases passed.
- `npm run test:look`: zero-click mouse look, Escape/F, panel pause, touch drag, and cleanup passed.
- `npm run test:galaxy-connection`: 10 integration groups passed after replacing the direct `THREE.PCFShadowMap` test-environment reference with a local numeric shadow constant.
- `npx tsc -b`: passed.
- `npx vite build --outDir artifacts/star-atelier/dist`: passed.
- Local route checks for `/observatory`, `/home`, and `/journey/sunset-boulevard` returned the current production HTML bundle.
- Local `/api/search?q=音乐 情绪 聆听` returned 10 items from the content service.

## Deployment

- Local previous `dist` was moved to `artifacts/star-atelier/last-local-dist-backup`.
- New local `dist` was installed from `artifacts/star-atelier/dist`.
- RTX deployment should keep the previous remote `dist` as a timestamped backup before swapping in the same build.

## Known Limits

- This pass uses procedural and existing project assets; it does not claim a one-to-one match with the concept renders.
- The Zhihu upstream answer expansion can fail independently of cached search results. The phone booth preserves existing real materials and reports the upstream failure instead of fabricating answers.
- Some Vite chunks remain larger than 500 kB. Existing lazy routes are preserved, but deeper chunk splitting is a separate performance pass.
