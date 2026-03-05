## 1. Dependencies & Icons

- [x] 1.1 Install `vite-plugin-pwa` as a dev dependency
- [x] 1.2 Create PWA icons: `public/pwa-192.png`, `public/pwa-512.png`, `public/pwa-maskable-512.png` from existing `public/favicon-128.png`

## 2. Vite Plugin Configuration

- [x] 2.1 Add `vite-plugin-pwa` to `vite.config.ts` with `generateSW` mode, `autoUpdate` registration, `standalone` display, theme/background colors `#1e1e1e`, icon entries, and `maximumFileSizeToCacheInBytes` ≥ 8MB

## 3. HTML Meta Tags

- [x] 3.1 Add `<meta name="theme-color" content="#1e1e1e">` and `<link rel="manifest" href="/manifest.webmanifest">` to `index.html`

## 4. Service Worker Registration

- [x] 4.1 Register the service worker in `src/main.ts` using `virtual:pwa-register`, guarded by `IS_TAURI` to skip registration in the Tauri webview

## 5. Verification

- [x] 5.1 Run `bun run build` and verify `dist/sw.js`, `dist/manifest.webmanifest`, and PWA icon files exist in output
- [x] 5.2 Run `bun run check` to confirm lint and typecheck pass
