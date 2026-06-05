## Why

OpenPencil can place raster images but can't turn them into editable vectors — a dropped-in logo or icon stays a locked bitmap. A remote raster→SVG vectorizer (Recraft) produces faithful, editable SVG paths at ~$0.01/image. Crucially, both Recraft-direct (`external.api.recraft.ai`) and fal (`fal-ai/recraft/vectorize`) expose **browser-callable** APIs (CORS verified live), so the conversion can run entirely client-side in the web PWA *and* desktop with the user's own key — the same direct-fetch pattern as the existing OpenAI/Anthropic chat providers. No proxy or backend is required.

## What Changes

- New canvas context-menu action **"Convert to Vector"**, shown only when a **single** node with an `IMAGE` fill is selected. It sends the image to the configured vectorizer and **replaces the image in place** with editable `VECTOR` nodes parsed from the returned SVG, positioned/sized to the original node's bounds. The whole replacement is **one undo step**.
- New **vectorization provider** setting: a dropdown (**Recraft** default, **fal**), each with its own API key entered through the existing **non-LLM key-field pattern** (like the Pexels/Unsplash keys) — explicitly **not** the chat `AI_PROVIDERS` / `createLanguageModel()` flow, since vectorizers are not chat LLMs.
- Input is **preprocessed** (short side upscaled to ≥256px, alpha preserved) to satisfy the vendor's minimum-dimension constraint; the returned SVG is stamped to the original image's pixel dimensions so it renders 1:1.
- **Async feedback** via toasts (in-progress + success/error). The toast system has no "loading" variant, so an `info` toast starts and `info`/`error` resolves.
- The vendor call is a **direct browser `fetch`** with the user's key — no proxy, no Tauri/Rust command — working identically in web and desktop.

### Non-goals (v1)

- **Gradient fills.** The existing SVG importer flattens `<defs>`/gradients to solid; acceptable for flat-color art (logos/icons), and is a documented fast-follow.
- Batch / multi-image vectorize, a cost/credit meter, and any first-party proxy for non-CORS providers.

## Capabilities

### New Capabilities

- `image-vectorization`: Convert a selected placed image into editable SVG vector nodes via a remote vectorizer, replacing it in place; undoable; with input preprocessing and async feedback.
- `vectorize-provider`: Select the vectorization provider (Recraft default, or fal) and store each provider's API key, reusing the non-LLM key-field settings pattern.

### Modified Capabilities

<!-- None: no existing specs in openspec/specs/. -->

## Impact

- **Core** (`packages/core/src/tools/vectorize/`, new): `preprocessForVectorize` (decode via CanvasKit, upscale short side ≥256, preserve alpha) and `svgToVectorNetwork` reusing `extractPaths` (`packages/core/src/icons/svg.ts`), `parseSVGPath` (`io/formats/svg/parse-path.ts`), `createVectorFromPath`/`parseSvgSize` (`tools/create/svg.ts`). Reuses `scene-graph` `VectorNetwork`/`Fill` types and `graph.images`. Kept platform-agnostic (the vendor `fetch` is injected from the app layer).
- **App glue** (`src/app/editor/vectorize/vectorize-image.ts`, new): read node bytes (`store.graph.images.get(imageHash)`) → vendor fetch with the selected provider's key → build the replacement under `store.undo.runBatch(...)` (ref: `placeImageNode` in `editor/clipboard/images.ts`). Toasts from `src/app/shell/ui.ts`.
- **Provider/keys**: `src/app/ai/chat/storage.ts` (+ re-export in `use.ts`) add `vectorizeProvider` + `recraftApiKey`/`falApiKey` `useLocalStorage` refs next to `pexelsApiKey`/`unsplashAccessKey`. `src/components/chat/ProviderSettings/context.ts` gains the input/save/clear wiring; new `VectorizeSection.vue` clones `StockPhotoKeysSection.vue` + `ProviderSettingsKeyField.vue` (plus a provider `AppSelect`), rendered in `ProviderSettings.vue`.
- **Context menu**: `src/app/editor/canvas/menu/{actions,context}.ts` add the gated "Convert to Vector" entry (single `IMAGE`-fill node).
- **i18n**: new strings in `packages/vue/src/i18n/messages.ts` and every `packages/vue/src/locales/*.json` (`check:i18n` gate).
- **Tests**: `tests/engine` unit (preprocess threshold, SVG→VectorNetwork mapping incl. viewBox→bounds scaling and gradient→solid fallback); `tests/e2e` context-menu gating + replace/undo with a mocked fetch.
- No kiwi codec / `.fig` schema changes; the vectorized result is ordinary `VECTOR` nodes.
