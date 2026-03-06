## Why

OpenPencil's web version (app.openpencil.dev) is a full-featured design editor deployed to Cloudflare Pages, but it lacks offline capability and native app-like UX. Users lose their work if they navigate away or lose connection. Adding PWA support enables installability, offline access to the shell/cached assets, and positions the web app closer to the Tauri desktop experience.

## What Changes

- Add a web app manifest (`manifest.webmanifest`) with app metadata, icons, and display mode
- Add a service worker for asset precaching (WASM, fonts, JS/CSS bundles) and runtime caching
- Integrate `vite-plugin-pwa` into the Vite build pipeline
- Register the service worker in the app entry point (browser only, skip in Tauri)
- Add PWA meta tags to `index.html` (theme-color, manifest link, apple status bar)
- Generate required icon sizes from existing assets (192×192, 512×512, maskable)

## Capabilities

### New Capabilities
- `pwa`: Progressive Web App support — manifest, service worker, installability, offline shell caching

### Modified Capabilities
- `desktop-app`: Guard service worker registration to avoid conflicts with Tauri runtime

## Impact

- **Vite config**: New plugin (`vite-plugin-pwa`) with workbox configuration
- **Dependencies**: `vite-plugin-pwa` (dev dependency)
- **index.html**: Meta tags for theme-color, manifest link
- **src/main.ts**: Service worker registration (conditional on non-Tauri)
- **public/**: Manifest file, PWA icons (192, 512, maskable)
- **CI**: No changes needed — `bun run build` already deploys to Cloudflare Pages, manifest + SW output automatically included in `dist/`
- **Bundle size impact**: Service worker file (~1KB generated), manifest file (<1KB). No impact on app JS bundle. WASM (~7MB) and fonts will be precached by the SW.
