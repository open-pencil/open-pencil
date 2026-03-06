## ADDED Requirements

### Requirement: Web app manifest
The app SHALL include a `manifest.webmanifest` file linked from `index.html` with `name` "OpenPencil", `short_name` "OpenPencil", `display` "standalone", `start_url` "/", `theme_color` "#1e1e1e", `background_color` "#1e1e1e", and icon entries for 192×192, 512×512, and maskable variants.

#### Scenario: Manifest served correctly
- **WHEN** a browser requests `/manifest.webmanifest`
- **THEN** the response is a valid JSON manifest with `display: "standalone"` and at least three icon entries

#### Scenario: Installability criteria met
- **WHEN** Chrome audits the web app for PWA installability
- **THEN** all criteria pass: manifest present, service worker registered, start_url responds, icons present

### Requirement: Service worker precaching
The build SHALL generate a service worker that precaches all build output assets including JavaScript bundles, CSS, WASM files, fonts, and icons. The Workbox `maximumFileSizeToCacheInBytes` SHALL be set to at least 8MB to accommodate the CanvasKit WASM (~7MB).

#### Scenario: Assets cached on first visit
- **WHEN** a user visits the app for the first time in a browser
- **THEN** the service worker installs and all precache-manifest assets are stored in CacheStorage

#### Scenario: App shell loads offline
- **WHEN** a user has previously visited the app and then loses network connectivity
- **THEN** the app shell (HTML, JS, CSS, WASM, fonts) loads from cache and the canvas initializes

### Requirement: Auto-update strategy
The service worker SHALL use an auto-update strategy: when a new version is detected, the SW activates immediately without requiring user interaction. The `skipWaiting` and `clientsClaim` options SHALL be enabled.

#### Scenario: Transparent update on new deployment
- **WHEN** a new version is deployed and the user revisits the app
- **THEN** the new service worker activates and serves updated assets without a reload prompt

### Requirement: PWA meta tags
`index.html` SHALL include `<meta name="theme-color" content="#1e1e1e">` and `<link rel="manifest" href="/manifest.webmanifest">`. The existing `apple-touch-icon` link SHALL be preserved.

#### Scenario: Theme color matches app background
- **WHEN** the browser reads meta tags
- **THEN** `theme-color` is `#1e1e1e` matching the app's dark background

### Requirement: PWA icons
The `public/` directory SHALL contain PWA icons at 192×192 (`pwa-192.png`), 512×512 (`pwa-512.png`), and a maskable icon at 512×512 (`pwa-maskable-512.png`) with safe-zone padding.

#### Scenario: Icon sizes available
- **WHEN** the manifest is parsed
- **THEN** icons at 192×192 (purpose "any"), 512×512 (purpose "any"), and 512×512 (purpose "maskable") are referenced and the files exist

### Requirement: Vite plugin integration
`vite-plugin-pwa` SHALL be configured in `vite.config.ts` using `generateSW` mode with `autoUpdate` registration type. The plugin SHALL be added to the Vite plugins array.

#### Scenario: Build produces SW
- **WHEN** `bun run build` completes
- **THEN** `dist/sw.js` and `dist/workbox-*.js` files exist alongside the precache manifest
