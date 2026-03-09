# Tech Stack

## Core Technologies

| Layer | Technology | Why |
|-------|-----------|-----|
| **Rendering** | Skia CanvasKit WASM | Same engine as Figma — proven performance, GPU-accelerated, pixel-perfect |
| **UI Framework** | Vue 3 + VueUse | Reactive composition API, excellent TypeScript support |
| **Components** | Reka UI | Headless, accessible UI primitives (tree, slider, etc.) |
| **Styling** | Tailwind CSS 4 | Utility-first, fast iteration, dark theme |
| **Layout** | Yoga WASM | CSS flexbox and grid engine from Meta, battle-tested in React Native |
| **File Format** | Kiwi binary + Zstd | Figma's own format — compact, fast parsing, .fig compatible |
| **Collaboration** | Trystero + Yjs | P2P WebRTC via MQTT signaling, CRDT sync, y-indexeddb persistence |
| **Color** | culori | Color space conversions (HSV, RGB, hex) |
| **AI/MCP** | MCP SDK + Hono | 87 tools for AI coding tools, stdio + HTTP transports |
| **Desktop** | Tauri v2 | ~5MB native app (vs Electron's ~100MB), Rust backend |
| **Build** | Vite 7 | Fast HMR, native ES modules |
| **Testing** | Playwright + bun:test | Visual regression (E2E) + fast unit tests |
| **Linting** | oxlint | Rust-based, orders of magnitude faster than ESLint |
| **Formatting** | oxfmt | Rust-based formatter |
| **Type Checking** | typescript-go (tsgo) | Native Go implementation of TypeScript type checker |

## Key Dependencies

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

## Why Not...

### Why not SVG rendering?

SVG is slow for complex documents. Every node is a DOM element — 10,000 nodes means 10,000 DOM nodes with layout, paint, and compositing overhead. CanvasKit draws everything to a single GPU surface. (Penpot still defaults to SVG rendering but has an opt-in Rust/Skia WASM renderer in development.)

### Why not Electron (like Figma desktop)?

Tauri v2 uses the system webview (~5MB) instead of bundling Chromium (~100MB). The Rust backend provides native performance for file I/O and system integration.

### Why not React (like the original plan)?

The project migrated from React to Vue 3 early in development. Vue's reactivity system and VueUse composables proved more ergonomic for the editor's state management needs.

### Why not custom layout engine?

Yoga is maintained by Meta, battle-tested across billions of React Native devices, and implements the CSS flexbox spec. Building a custom engine would be months of work to reach the same correctness level.

## Planned Technologies

| Technology | Purpose | Phase |
|-----------|---------|-------|
| CSS Grid in Yoga | Grid-based auto layout | ✅ Supported via [Yoga fork](https://github.com/open-pencil/yoga/tree/grid) |
