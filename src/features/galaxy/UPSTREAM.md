# Wanderwise galaxy integration

This directory vendors the galaxy frontend from [Wood3307/Wanderwise](https://github.com/Wood3307/Wanderwise), branch `main`, commit [`43094bdf13282e963baa80510f7bf6de074b2af8`](https://github.com/Wood3307/Wanderwise/commit/43094bdf13282e963baa80510f7bf6de074b2af8), titled “星空7.1版本：字体调大，markdown修复（还未完成），黑洞吞噬动效优化”. The source checkout is `../Wanderwise-upstream-20260914`, alongside the host app. The preceding integrated baseline was `229e4bd1a9623fa6a10f53387f31259434823976`. Preserve upstream authorship and applicable notices; no new source license is asserted here.

This document records the integration scope and host contracts. Checklists are required validation, not a claim that the current update has already passed tests, browser review or deployment.

## Upstream v6–v7.1 changes

- Search voyage: keep the old scene through disintegration and black-hole absorption, then reveal the latest result with a burst and expanding light. Requests run alongside animation; superseded results must never replace the latest query. Reduced motion switches directly.
- More separated galaxy placement, no decorative inter-galaxy lines, and revised intermittent comet motion around the outer stellar system.
- Larger Chinese reading text with Zhuque Fangsong; Markdown/LaTeX presentation, format-aware excerpt handling, and glyph sampling that accounts for rendered mathematics. Raw source strings remain the values used by selection, saving and reflection. The upstream 7.1 commit explicitly describes Markdown repair as unfinished; do not claim complete syntax support without validation.
- Background music and its controls. The host integration uses `/galaxy/audio/`, obeys the host muted preference, and distinguishes enabled playback intent from actual browser playback. See the host third-party notice for audio provenance and authorization limits.

## Host mounting, routes and entry

`index.tsx` is the default route export, mounted lazily under the host React Router at `/galaxy`. Use the host React and Three dependencies. Do not import upstream `main.tsx`, create another React root, replace the host server, or nest this imperative renderer inside an observatory R3F Canvas. Only the current major scene owns a live renderer.

The wrapper preserves the host-specific `returnLabel` and `entrySources` props on `App.tsx`:

- A navigation carrying `location.state.wanderwiseEntry` may consume the current personal `returnAnchor`. Direct URL entry does not reuse a stale journey anchor and defaults to the observatory.
- The anchor source and journey sources are passed as `entrySources`. Initial reading displays their actual summaries/guides without pretending to retrieve full bodies or asking the upstream API to regenerate them. A new search remains available.
- The cancelable `wanderwise:return` event is handled by React Router. Journey return restores the same journey instance, `activeStation` and saved pose, then navigates to `/journey/:realmId?trip=...`. Other entries use their registered route or `/observatory`.
- Search, discovery and saved-visit `history.replaceState` calls retain `window.history.state`, including Router keys and host entry state.
- The wrapper restores the previous document title and removes its return listener on unmount.

Retain `lib/integration.ts`: `q`/`topic` input, sanitized query limits, safe relative return URLs, `wanderwise:enter`, same-origin postMessage, `window.Wanderwise.enter`, cleanup and `wanderwise:ready`. Absolute, foreign-origin, executable and malformed return values are rejected. The host prevents full document navigation during integrated return.

## Shared personal data, not a second galaxy vault

The host waits for `initializePersonalSpace()` before mounting routes. The `wanderwise-personal` IndexedDB store is authoritative once ready. `lib/storage.ts` loads and saves through `src/features/personal/galaxyBridge.ts`; the original keys remain compatible fallbacks/backups:

- `wanderwise.collection.v1`: up to 500 visible saved groups.
- `wanderwise.reflections.v1`: up to 500 visible notes.
- `wanderwise.journey.v1`: legacy galaxy visit history; loader limit 1000, App rolling limit 300. This is distinct from the host's playable journey instances.

The original documentation's statement that galaxy and cabin collections are separate is obsolete. The shared bridge connects the cabin, collection tree, land and galaxy while existing migrations retain old game and cocktail data.

Source identity is canonicalized by the personal persistence layer. Preserve real remote IDs, publisher names, original URLs, curated status, content types and confirmed question membership. Distinct excerpts from one source remain independent records. Explicit removal of a visible source group can remove that group's collections, but must not remove independent notes.

`saveSharedCollection` and `saveSharedReflections` receive the **complete visible list** and infer explicit deletions from missing IDs. Never pass a filtered page, a smaller display cap or an initial empty placeholder: doing so can remove existing player data. Preserve notes beyond the projected 500. Storage validation, bounded imports, failure reporting and backups remain in effect; localStorage quota failure does not override a valid shared-store save.

Do not rewrite `wanderwise-game-v1`, old recipe keys, or personal source/collection IDs during the visual update. Retain personal import/export and idempotent migrations. The imported 30-source starter collection is browser/origin-specific; it is not a default collection for every visitor.

## Content and reading contracts

Frontend requests stay same-origin: `/api/health`, `/api/explore`, `/api/questions/:id`, `/api/knowledge/:workId`, and `/api/answers/:id/highlights`. The host Express service owns the official CLI, persistent public SQLite cache, budgets and access controls. Credentials and optional model settings remain server-side.

Keep actual question, article and topic-aggregation types distinct. `question-*`, `answer-*`, `article-*`, `title-*`, `topic-*` and `knowledge-*` are different source/aggregation identities, not interchangeable labels. Only confirmed question membership may be expanded. A saved stop reopens by exact ID, with the existing exact `knowledge-*` legacy lookup; a similar title is never sufficient.

`Answer.isExcerpt`, `sourceName`, `curated` and `workId` distinguish search summaries, project reading guides and official partial body text. Nonempty paragraphs do not prove full-text availability. Preserve missing-author markers, actual source links, honest loading/error/retry states and empty results. Do not manufacture fallback posts.

Highlights and selected quotations must match a real substring in their indexed source paragraph. Preserve response answer-ID checks and source-key invalidation when text changes. Markdown/LaTeX is a presentation of that same source; formatting must not silently alter saved quotes, turn untrusted markup into executable content, or relabel partial content as a complete article.

## Styles, fonts and assets

All galaxy styles are scoped to `.galaxy-page`, including reset selectors and pseudo-elements. Keyframes use `ww-galaxy-`. Font families are `Wanderwise Galaxy Sans`, `Wanderwise Galaxy CJK` and `Wanderwise Galaxy Fangsong`, avoiding changes to the cabin font registry. Keep React 19 boolean `inert` props.

Runtime images, fonts and audio are local and namespaced under `/galaxy/`. Zhuque Fangsong full/initial WOFF2 files and `OFL-ZhuqueFangsong.txt` are under `public/galaxy/fonts`; mathematics uses the local KaTeX font assets. The original favicon stays namespaced and does not replace the host favicon. The upstream HTML shell and reference checkout are not imported.

`public/galaxy/audio/day-one.mp3` and `day-one.flac` retain the upstream user-provided Hans Zimmer “Day One” provenance. They are not labeled CC0; this integration does not assert an expanded music-use authorization. See `docs/galaxy-third-party-notices.md`.

## Interaction and lifecycle

The explicit return button keeps a visible destination label and H shortcut. Typing, composition, modifiers and active reader/dialog states must not trigger a return. Preserve focus restoration, modal `inert` behavior and safe back/forward handling.

Honor reduced motion for search voyage, glyph effects, rotation and comets; retain usable manual navigation. Honor the host muted setting rather than importing the upstream default as permission to start audible playback. Reading and input pause autonomous motion without losing navigation.

`GalaxyScene` owns its renderer, animation loop, observers, input/visibility listeners and temporary GPU systems. Dispose them on route unmount; cancel pending requests and glyph frames, and stop/release route-owned audio. Resource disposal stays idempotent. Do not keep the observatory renderer mounted behind the galaxy or lose a reused canvas context during a routine layout rebuild.

## Validation entry points

From the host app:

```sh
npm run test:personal
npm run test:content
npm run test:galaxy
npm run test:galaxy-connection
node src/features/galaxy/tools/run-tests.mjs
node src/features/galaxy/tools/verify-styles.mjs
npx tsc -b
npx eslint src/features/galaxy
```

The galaxy runner bundles the available unit tests into a temporary directory and removes its own temporary outputs. Do not use old fixed test counts as evidence that new rich-text, comet or search-transition tests ran. Unit and integration checks use isolated data; they do not replace browser verification.

Browser review must cover existing collections and notes, journey station/pose return, direct entry, source labels and quote matching, latest-search wins, failed/empty retry, Markdown and mathematics selection, reduced motion, host mute/autoplay behavior, touch controls, and repeated route transitions without extra live renderers or audio. Record actual outcomes separately; this document does not predeclare them successful.
