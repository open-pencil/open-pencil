## Context

OpenPencil places raster images as a `RECTANGLE`/`FRAME` node with an `IMAGE` fill (`{type:'IMAGE', imageHash}`); the bytes live in `SceneGraph.images: Map<hash, Uint8Array>` (`packages/core/src/scene-graph`). The editor already imports SVG into editable vectors: `extractPaths` (`packages/core/src/icons/svg.ts`) → `parseSVGPath` (`io/formats/svg/parse-path.ts`) → `createVectorFromPath` (`tools/create/svg.ts`) builds a FRAME of `VECTOR` children from a viewBox. Undoable multi-mutation edits run through `store.undo.runBatch(label, fn)` (`scene-graph/undo.ts`); `placeImageNode` (`editor/clipboard/images.ts`) is the reference for image-byte access and the forward/inverse pattern.

The AI chat already stores **non-LLM** API keys outside the chat-provider flow: `pexelsApiKey` / `unsplashAccessKey` are plain `useLocalStorage` refs in `src/app/ai/chat/storage.ts`, surfaced via `ProviderSettings/context.ts` + `StockPhotoKeysSection.vue` + the reusable `ProviderSettingsKeyField.vue`. This is the exact precedent for the vectorizer keys.

The chat providers themselves call vendor APIs **directly from the browser** with the user's key (`createOpenAI`/`createAnthropic` in `src/app/ai/chat/model.ts`); this works because those vendors return permissive CORS headers. Verified live (OPTIONS preflight): **Recraft-direct and fal both return `access-control-allow-origin`** for POST + the result CDN serves SVG with `access-control-allow-origin: *`. **Replicate returns no CORS headers**, so it is excluded — it would require a proxy and is not usable browser-side.

## Goals / Non-Goals

**Goals**
- Convert a single selected image node into editable `VECTOR` nodes and replace it in place, undoably (one step).
- Provider is user-selectable: **Recraft** (default) or **fal**, each with its own key, via the non-LLM key pattern.
- Works in the **web PWA and desktop** with a direct browser `fetch` — no proxy, no Rust.
- Result renders 1:1 with the original image.

**Non-Goals**
- Gradient / `<defs>` fidelity (v1 flattens to solid via the existing importer).
- Batch/multi-select vectorize, cost metering, provider auto-fallback.
- Any first-party proxy or support for non-CORS providers (Replicate).
- Changing the kiwi codec or `.fig` schema.

## Decisions

### Direct browser fetch, no proxy
Call the vendor from the app layer with `fetch` and the user's key, mirroring the chat providers. Recraft-direct: `POST https://external.api.recraft.ai/v1/images/vectorize` (multipart `file`, `Authorization: Bearer`), returns `{image:{url}}`; fetch that SVG URL. fal: `POST https://fal.run/fal-ai/recraft/vectorize` (`Authorization: Key`, JSON `{image_url: <data-uri>}`), returns a result object containing the SVG URL. Both CORS-verified.
- **Why:** zero backend, identical web/desktop behavior, consistent with existing key-in-browser model.
- **Alternative (Replicate via Tauri/Rust proxy):** rejected — Replicate blocks browser CORS, so it would force a Rust command + desktop-only or a hosted proxy. Recraft/fal remove the need entirely.

### Recraft-direct default, fal fallback
Same Recraft engine behind both → byte-identical output. Recraft-direct is faster (~3–4s vs ~5–7s), $0.01/image (10 API units; `$5 = 5000 units`, **units do not expire**). fal is also $0.01/call but **credits expire in 365 days**. Default Recraft; offer fal as an alternative in the dropdown.

### Keys via the non-LLM `useLocalStorage` pattern, not `AI_PROVIDERS`
Add `vectorizeProvider` (`'recraft' | 'fal'`, default `'recraft'`), `recraftApiKey`, `falApiKey` next to `pexelsApiKey`. The vectorizers are not chat models, so they must not enter `AI_PROVIDERS`/`createLanguageModel()`. The app-layer vectorize call reads the active provider's key ref directly.

### Atomic replace sized to original bounds
Inside `store.undo.runBatch('Vectorize image', …)`: build a FRAME at the original node's `x/y/width/height` and `parentId`, add `VECTOR` children from `svgToVectorNetwork`, delete the original node, select the new frame. Map the SVG viewBox onto the original pixel bounds; stamp the SVG/frame size to the original dimensions so the result is 1:1 (Recraft already returns SVG stamped with input dims, but normalize defensively). Drop the orphaned image from `graph.images` only if no other fill references the hash (mirror `placeImageNode`'s inverse cleanup).

### Preprocess to the vendor input contract
Recraft requires **min dimension 256px** (else error). `preprocessForVectorize` decodes via CanvasKit, and if `min(w,h) < 256` upscales (preserve alpha) before sending. Max 4096px / 16MP / 5MB enforced. No upscaling when already ≥256 (avoids inflating output dimensions).

### Async UX with existing toasts
`src/app/shell/ui.ts` exposes `info`/`warning`/`error` (no `loading`/`promise`). Show an `info` toast on start and `info`/`error` on completion; gate the menu action while a conversion is in flight.
