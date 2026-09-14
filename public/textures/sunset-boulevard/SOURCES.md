# Patterned Cobblestone

- Author: **Rob Tuytel / Poly Haven**.
- Official asset page: https://polyhaven.com/a/patterned_cobblestone
- Official license: https://polyhaven.com/license — **CC0 1.0** for the asset files, including redistribution and commercial use.
- Retrieved: 2026-09-14.
- Physical coverage: **2.5 × 2.5 metres** per repeating tile, as specified by the asset page.

The diffuse, OpenGL normal and roughness maps were downloaded at 2048 × 2048 from the asset's public API-listed files. Each original was verified against its API MD5 checksum and retained in `assets/source/sunset-boulevard/`. The runtime WebP files preserve the 2048 × 2048 resolution; the existing Pillow-based asset pipeline re-encodes the upstream originals at quality 72/80/70 respectively (method 6). The normal map uses the highest quality of the three. There is no artistic repainting or invented source attribution. `manifest.json` records exact download URLs, SHA-256, processing and runtime sizes.

Diffuse is interpreted as sRGB; normal and roughness are linear data textures. The runtime material uses world-space UVs at the stated scale and applies low-frequency dry/wet roughness variation without changing the walkable surface or amplifying geometry displacement.

The Poly Haven site design, logos and preview renders are not included; the download covers only the CC0 asset maps.
