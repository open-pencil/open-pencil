## 1. Provider selection & key storage

- [ ] 1.1 In `src/app/ai/chat/storage.ts` add `vectorizeProvider = useLocalStorage<'recraft'|'fal'>('open-pencil:vectorize-provider', 'recraft')`, `recraftApiKey = useLocalStorage('open-pencil:recraft-api-key', '')`, and `falApiKey = useLocalStorage('open-pencil:fal-api-key', '')` next to `pexelsApiKey`/`unsplashAccessKey`. Do NOT touch `AI_PROVIDERS`/`model.ts`.
- [ ] 1.2 Re-export the three new refs from `src/app/ai/chat/use.ts` (mirror `pexelsApiKey`/`unsplashAccessKey`).
- [ ] 1.3 In `src/components/chat/ProviderSettings/context.ts` add `recraftKeyInput`/`falKeyInput`, `hasExistingRecraftKey`/`hasExistingFalKey`, the `save()` branches, and `clearRecraftKey`/`clearFalKey` (copy the pexels block); expose `vectorizeProvider`.

## 2. Vectorize settings UI (dropdown + key field)

- [ ] 2.1 New `src/components/chat/ProviderSettings/VectorizeSection.vue`: a provider `AppSelect` (Recraft default, fal) bound to `ctx.vectorizeProvider`, plus one `ProviderSettingsKeyField` bound to the **active** provider's key input (Recraft → `recraftKeyInput`, fal → `falKeyInput`) with the matching `key-url` (`https://www.recraft.ai/account/api` / fal dashboard) and saved-state from the active provider's key.
- [ ] 2.2 Render `<VectorizeSection />` in `src/components/chat/ProviderSettings/ProviderSettings.vue` next to `<StockPhotoKeysSection />`.

## 3. Vectorize core (platform-agnostic)

- [ ] 3.1 New `packages/core/src/tools/vectorize/preprocess.ts`: `preprocessForVectorize(bytes, getCk)` — decode via `MakeImageFromEncoded`; if `min(w,h) < 256` upscale (preserve alpha) and re-encode PNG via `encodeToBytes`/`ckImageFormat` (ref `io/formats/raster/render.ts`); enforce max 4096px/16MP/5MB. Return PNG bytes + original dims.
- [ ] 3.2 New `packages/core/src/tools/vectorize/svg-to-vectors.ts`: `svgToVectorNetwork(svgText, bounds)` reusing `extractPaths` (`packages/core/src/icons/svg.ts`), `parseSVGPath` (`io/formats/svg/parse-path.ts`), `createVectorFromPath`/`parseSvgSize` (`tools/create/svg.ts`); map the SVG viewBox onto `bounds` so output is 1:1; gradient/`<defs>` fills fall back to solid (documented).
- [ ] 3.3 Keep core free of any vendor `fetch`/app import; the network call is injected from the app layer (verify with `bun run check:arch` — Steiger).

## 4. App glue: convert action

- [ ] 4.1 New `src/app/editor/vectorize/providers.ts`: `recraftVectorize(png, key)` (POST `external.api.recraft.ai/v1/images/vectorize`, multipart `file`, Bearer → `{image:{url}}` → fetch SVG) and `falVectorize(png, key)` (POST `fal.run/fal-ai/recraft/vectorize`, `Authorization: Key`, JSON `{image_url:<data-uri>}` → result url → fetch SVG). Plain browser `fetch`.
- [ ] 4.2 New `src/app/editor/vectorize/vectorize-image.ts`: `vectorizeImageNode(store, nodeId)` — read node + bytes (`store.graph.images.get(imageHash)`), check active `vectorizeProvider` + its key (guard: missing key → error toast, no-op), `preprocessForVectorize`, call the provider, then inside `store.undo.runBatch('Vectorize image', …)` build a FRAME at the original `x/y/width/height` under the same parent, add vector children from `svgToVectorNetwork`, delete the original node (drop orphan image hash like `placeImageNode`'s inverse), select the new frame, `requestRender()`. Use `info`/`error` toasts from `src/app/shell/ui.ts`; prevent re-entrancy while in flight.

## 5. Context-menu integration

- [ ] 5.1 In `src/app/editor/canvas/menu/actions.ts` add `vectorizeImage()` calling `vectorizeImageNode(store, …)` and a `singleImageNodeSelected` guard (`selectedIds.size === 1` and the node `fills.some(f => f.type==='IMAGE' && f.imageHash)`).
- [ ] 5.2 In `src/app/editor/canvas/menu/context.ts` (`useCanvasContextMenu`) append `{ label: t.convertToVector, action: actions.vectorizeImage, testId: 'context-vectorize' }` only when the guard passes (mirror how `copyPasteAsEntry` is appended).

## 6. i18n

- [ ] 6.1 Add `menu.convertToVector`, `dialogs.vectorizeProvider`, `dialogs.recraftAPIKey`, `dialogs.getRecraftAPIKey`, `dialogs.falAPIKey`, `dialogs.getFalAPIKey`, and an "add a key" prompt string to `packages/vue/src/i18n/messages.ts`.
- [ ] 6.2 Add the same keys to every `packages/vue/src/locales/*.json` and run `bun run check:i18n` until clean.

## 7. Tests & verification

- [ ] 7.1 `tests/engine` unit (no network): `preprocessForVectorize` upscale threshold (≥256 untouched, <256 upscaled, alpha preserved) and `svgToVectorNetwork` (multi-path solid fills, fill-rule, viewBox→bounds 1:1 scaling, gradient→solid fallback).
- [ ] 7.2 `tests/e2e` (mock the provider `fetch`): "Convert to Vector" appears only for a single IMAGE node; converting replaces the image with vectors at the same bounds; a single undo restores the image; missing-key path shows an error and leaves the canvas unchanged.
- [ ] 7.3 Live checks: `bun run dev` (web) and `bun run tauri dev` (desktop) — place a PNG, set a Recraft key, Convert to Vector, confirm editable vectors at 1:1 and one-step undo; switch provider to fal and confirm parity.
- [ ] 7.4 Gates on changed files: `bun run check` (lint + typecheck), `bun run check:i18n`, `bun run check:arch` (core stays platform-agnostic), and the new engine tests.

## 8. Commit

- [ ] 8.1 Commit on a feature branch (e.g. `feat(vectorize): image → editable SVG via Recraft/fal`), formatted; do not push unless requested.
