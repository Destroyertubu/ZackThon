# Sunset Boulevard architectural kit

The `bookshop.glb`, `atelier.glb` and `gallery.glb` meshes are authored for this project. They are not downloaded marketplace models. The editable source is `assets/source/sunset-boulevard/sunset-architecture.blend`; reproduce it with `scripts/build-sunset-architecture.py` (Blender 5.2.1). `--export-only` re-exports that saved source.

The GLBs retain real arched openings, deep interiors, rounded mouldings, curved copper roofs, individual books, inset glass and lamp fixtures. Runtime materials are supplied by the same PBR palette as the surrounding promenade. Blender's built-in glTF exporter applies modifiers and Draco compression; the browser uses the existing local decoder in `/models/garden/draco/`.

The export `manifest.json` records byte size and triangle count. The browser reuses geometry for the two atelier instances. Original editable objects and modifiers are preserved in the `.blend`; only the runtime export merges by material.

The garden trees and small botanical meshes are project-authored procedural geometry in `SunsetAssets.tsx` and `architecture.ts`. Their leaves have curved polygon silhouettes and are instanced, without billboard leaf sheets. The public-domain museum paintings continue to use the existing source list in `src/features/journeys/scene/assets/SOURCES.md`.

See `/textures/sunset-boulevard/SOURCES.md` for the only newly downloaded external texture set.
