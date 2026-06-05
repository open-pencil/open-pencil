## 1. Provider selection & key storage

- [x] 1.1 In `src/app/ai/chat/storage.ts` add `vectorizeProvider = useLocalStorage<'recraft'|'fal'>('open-pencil:vectorize-provider', 'recraft')`, `recraftApiKey = useLocalStorage('open-pencil:recraft-api-key', '')`, and `falApiKey = useLocalStorage('open-pencil:fal-api-key', '')` next to `pexelsApiKey`/`unsplashAccessKey`. Do NOT touch `AI_PROVIDERS`/`model.ts`.
- [x] 1.2 Re-export the three new refs from `src/app/ai/chat/use.ts` (mirror `pexelsApiKey`/`unsplashAccessKey`).
- [x] 1.3 In `src/components/chat/ProviderSettings/context.ts` add `recraftKeyInput`/`falKeyInput`, `hasExistingRecraftKey`/`hasExistingFalKey`, the `save()` branches, and `clearRecraftKey`/`clearFalKey` (copy the pexels block); expose `vectorizeProvider`.

## 2. Vectorize settings UI (dropdown + key field)

- [x] 2.1 New `src/components/chat/ProviderSettings/VectorizeSection.vue`: a provider `AppSelect` (Recraft default, fal) bound to `ctx.vectorizeProvider`, plus one `ProviderSettingsKeyField` bound to the **active** provider's key input (Recraft → `recraftKeyInput`, fal → `falKeyInput`) with the matching `key-url` (`https://www.recraft.ai/account/api` / fal dashboard) and saved-state from the active provider's key.
- [x] 2.2 Render `<VectorizeSection />` in `src/components/chat/ProviderSettings/ProviderSettings.vue` next to `<StockPhotoKeysSection />`.

## 3. Vectorize core (platform-agnostic)

- [x] 3.1 New `packages/core/src/tools/vectorize/preprocess.ts`: `preprocessForVectorize(bytes, getCk)` — decode via `MakeImageFromEncoded`; if `min(w,h) < 256` upscale (preserve alpha) and re-encode PNG via `encodeToBytes`/`ckImageFormat` (ref `io/formats/raster/render.ts`); enforce max 4096px/16MP/5MB. Return PNG bytes + original dims.
- [x] 3.2 New `packages/core/src/tools/vectorize/svg-to-vectors.ts`: `svgToVectorPaths(svgText, bounds)` reusing `extractPaths` (`packages/core/src/icons/svg.ts`), `parseSVGPath` (`io/formats/svg/parse-path.ts`); map the SVG viewBox onto `bounds` so output is 1:1; gradient/`<defs>` fills fall back to solid (documented).
- [x] 3.3 Keep core free of any vendor `fetch`/app import; the network call is injected from the app layer (verify with `bun run check:arch` — Steiger).

## 4. App glue: convert action

- [x] 4.1 New `src/app/editor/vectorize/providers.ts`: `recraftVectorize(png, key)` (POST `external.api.recraft.ai/v1/images/vectorize`, multipart `file`, Bearer → `{image:{url}}` → fetch SVG) and `falVectorize(png, key)` (POST `fal.run/fal-ai/recraft/vectorize`, `Authorization: Key`, JSON `{image_url:<data-uri>}` → result url → fetch SVG). Plain browser `fetch`.
- [x] 4.2 New `src/app/editor/vectorize/vectorize-image.ts`: `vectorizeImageNode(store, nodeId)` — read node + bytes, check provider key, preprocess, call provider, replace with FRAME+VECTOR children via explicit `undo.push` (subtree snapshots), select frame, toasts, re-entrancy guard.

## 5. Context-menu integration

- [x] 5.1 In `src/app/editor/canvas/menu/actions.ts` add `vectorizeImage()` and `canVectorizeImage()` guard.
- [x] 5.2 In `src/app/editor/canvas/menu/context.ts` append "Convert to Vector" when guard passes; `CanvasMenu.vue` uses `item.testId` for custom entries.

## 6. i18n

- [x] 6.1 Add menu/dialog strings to `packages/vue/src/i18n/messages.ts`.
- [x] 6.2 Add keys to every `packages/vue/src/locales/*.json`; `bun run check:i18n` clean.

## 7. Tests & verification

- [x] 7.1 `tests/engine/tools/vectorize.test.ts` — preprocess + svgToVectorPaths.
- [x] 7.2 `tests/e2e/vectorize/basic.spec.ts` — menu gating, convert+undo, missing key (mocked fetch).
- [x] 7.3 Live checks: Recraft/fal with real keys (manual).
- [x] 7.4 Gates: `bun run check`, `check:arch`, `check:i18n`, engine + e2e tests.

## 8. Commit

- [x] 8.1 Commit on feature branch, formatted; do not push unless requested.