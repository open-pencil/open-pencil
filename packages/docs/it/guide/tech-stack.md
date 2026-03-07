# Stack tecnologico

## Tecnologie principali

| Livello | Tecnologia | Perché |
|---------|-----------|--------|
| **Rendering** | Skia CanvasKit WASM | Stesso motore di Figma — prestazioni provate, accelerato GPU, pixel-perfetto |
| **Framework UI** | Vue 3 + VueUse | API di composizione reattiva, eccellente supporto TypeScript |
| **Componenti** | Reka UI | Primitivi UI headless e accessibili (tree, slider, ecc.) |
| **Stile** | Tailwind CSS 4 | Utility-first, iterazione rapida, tema scuro |
| **Layout** | Yoga WASM | Motore CSS flexbox di Meta, collaudato in React Native |
| **Formato file** | Kiwi binario + Zstd | Formato proprio di Figma — compatto, parsing veloce, compatibile .fig |
| **Collaborazione** | Trystero + Yjs | P2P WebRTC via segnalazione MQTT, sync CRDT, persistenza y-indexeddb |
| **Colore** | culori | Conversioni spazio colore (HSV, RGB, hex) |
| **IA/MCP** | MCP SDK + Hono | 75 strumenti per il coding IA, trasporti stdio + HTTP |
| **Desktop** | Tauri v2 | ~5 MB app nativa (vs ~100 MB di Electron), backend Rust |
| **Build** | Vite 7 | HMR veloce, moduli ES nativi |
| **Test** | Playwright + bun:test | Regressione visiva (E2E) + test unitari veloci |
| **Linting** | oxlint | Basato su Rust, ordini di grandezza più veloce di ESLint |
| **Formattazione** | oxfmt | Formattatore basato su Rust |
| **Verifica tipi** | typescript-go (tsgo) | Implementazione nativa in Go del type checker TypeScript |

## Dipendenze principali

```json
{
  "canvaskit-wasm": "^0.40.0",
  "vue": "^3.5.29",
  "yoga-layout": "^3.2.1",
  "reka-ui": "^2.8.2",
  "tailwindcss": "^4.2.1",
  "culori": "^4.0.2",
  "fzstd": "^0.1.1",
  "fflate": "^0.8.2",
  "trystero": "^0.20.0",
  "yjs": "^13.6.24",
  "y-indexeddb": "^9.0.12"
}
```

## Perché non...

### Perché non il rendering SVG?

SVG è lento per documenti complessi. Ogni nodo è un elemento DOM — 10.000 nodi significano 10.000 elementi DOM con overhead di layout, disegno e composizione. CanvasKit disegna tutto su una singola superficie GPU.

### Perché non Electron (come Figma desktop)?

Tauri v2 usa il webview di sistema (~5 MB) invece di incorporare Chromium (~100 MB). Il backend Rust fornisce prestazioni native per I/O file e integrazione di sistema.

### Perché non React?

Il progetto è migrato da React a Vue 3 nelle fasi iniziali. Il sistema di reattività di Vue e i composables VueUse si sono rivelati più ergonomici.

### Perché non un motore di layout personalizzato?

Yoga è mantenuto da Meta, collaudato su miliardi di dispositivi React Native e implementa la specifica CSS flexbox.

## Tecnologie pianificate

| Tecnologia | Scopo | Fase |
|-----------|---------|-------|
| CSS Grid in Yoga | Auto layout basato su griglia | Bloccato da upstream (facebook/yoga#1893) |
