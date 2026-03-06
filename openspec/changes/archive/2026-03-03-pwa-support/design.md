## Context

OpenPencil web app is deployed to Cloudflare Pages at `app.openpencil.dev`. The build produces a ~11MB `dist/` with a 7MB CanvasKit WASM, ~2.4MB JS bundle, fonts, and icons. The app uses Vue 3 + Vite, renders entirely on a WebGL canvas (no DOM rendering for design content), and has two routes (`/` and `/share/:roomId`). There is no service worker or manifest — the web app cannot be installed or used offline.

The Tauri desktop app shares the same frontend but wraps it in a native shell with native file dialogs, Zstd compression, and system font access via Rust commands. PWA must not interfere with Tauri runtime.

## Goals / Non-Goals

**Goals:**
- Make the web app installable (A2HS prompt, standalone window)
- Precache critical assets (WASM, fonts, JS/CSS) so the app shell loads offline
- Generate the manifest and SW at build time with zero manual maintenance
- Conditionally skip SW registration inside Tauri webview

**Non-Goals:**
- Full offline editing (requires IndexedDB document persistence — separate change)
- Background sync or push notifications
- Caching user-uploaded images or .fig files in the SW
- Custom update UI (use `vite-plugin-pwa` autoUpdate for now)

## Decisions

### 1. Use `vite-plugin-pwa` with Workbox `generateSW`

**Rationale:** `vite-plugin-pwa` is the standard for Vite projects. `generateSW` (vs `injectManifest`) is simpler — Workbox auto-generates the SW with precache manifest from the build output. No custom SW logic needed at this stage.

**Alternatives considered:**
- Manual `workbox-cli` — more boilerplate, must maintain SW separately
- `injectManifest` — gives full SW control but overkill for asset precaching

### 2. `autoUpdate` registration type

**Rationale:** The app is a single-page editor. Auto-updating the SW on new versions avoids stale caches without needing a "New version available" prompt. Users always get the latest build on next visit.

**Alternatives considered:**
- `prompt` — shows update banner, but adds UI complexity for minimal benefit in an editor app where the session is typically fresh

### 3. Precache strategy: all build output including WASM

**Rationale:** The 7MB CanvasKit WASM is the critical asset. Without it, the app is a blank screen. Precaching it means repeat visits load instantly even on slow connections. Workbox's `maximumFileSizeToCacheInBytes` must be raised to ~8MB.

The `Inter-Regular.ttf` font in `public/` will also be precached as part of the glob.

### 4. Guard SW registration with `IS_TAURI`

**Rationale:** Inside Tauri's webview, a service worker would intercept network requests unnecessarily and could conflict with Tauri's IPC. The `IS_TAURI` constant from `@open-pencil/core` already exists and is the project convention for Tauri detection.

### 5. `standalone` display mode

**Rationale:** Matches the desktop app experience — no browser chrome. The editor uses the full viewport. `minimal-ui` would add a browser nav bar that wastes space and conflicts with the editor's own toolbar.

### 6. Icon generation from existing favicon-128

**Rationale:** The project already has `favicon-128.png` and `apple-touch-icon.png`. PWA requires 192×192 and 512×512. These need to be created once and committed to `public/`. A maskable variant (with padding) is needed for Android adaptive icons.

## Risks / Trade-offs

- [Large precache payload (~10MB)] → Acceptable for a design editor. First visit already downloads all this; SW just caches it for subsequent visits. Cloudflare Pages has no bandwidth cost.
- [SW cache invalidation] → Workbox uses content hashes in the precache manifest. New builds automatically invalidate changed assets.
- [Tauri interference] → Mitigated by `IS_TAURI` guard. SW is never registered in Tauri context.
- [Cloudflare Pages MIME type for `.webmanifest`] → Cloudflare Pages serves `.webmanifest` with correct `application/manifest+json` MIME type by default.
