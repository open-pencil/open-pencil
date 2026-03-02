# Changelog

## 0.3.2 (2026-03-02)

### Performance

- Re-apply SkPicture scene caching for ~7x faster pan/zoom (0.98ms vs 6.8ms per frame at 500 nodes)

### Tests

- Visual regression tests for SkPicture cache: hover on/off cycle, multiple cycles, mouse hover, scene change + hover
- Type `window.__OPEN_PENCIL_STORE__` globally, remove ad-hoc casts from tests

## 0.3.1 (2026-03-02)

### Fixes

- Fix text disappearing after hovering a frame (revert SkPicture scene caching)
- Fix macOS startup hang: async font loading, show window on reopen

## 0.3.0 (2026-03-01)

### Performance

- SkPicture scene caching — pan/zoom replays cached display list instead of re-rendering all nodes
- Cache vector network paths — avoid rebuilding WASM paths every frame
- Cache ruler and pen overlay paints — eliminate 10 WASM Paint allocations per frame
- Only enable `preserveDrawingBuffer` in test mode
- Hoist URL param parsing out of render loop

### Fixes

- Fix npm publish: use pnpm for workspace dependency resolution with provenance
- CLI version now reads from package.json instead of hardcoded value
- Update README: accurate app size (~7 MB), streamlined feature list, current project structure

## 0.2.1 (2026-03-01)

### UI

- Panel header with app logo, editable document name, and sidebar toggle
- ⌘\\ to toggle side panels for distraction-free canvas
- Panels hidden by default on mobile (< 768px)
- Floating bar with logo, filename, and restore button when panels hidden
- Always show local user avatar in collab header
- Touch support for pan and pinch-zoom on iOS

### Performance

- Stubbed shiki to remove 9MB of unused language grammars (20MB → 11MB bundle)

## 0.2.0 (2026-03-01)

### Collaboration

- Real-time P2P collaboration via Trystero (WebRTC) + Yjs CRDT
- Peer-to-peer sync — no server relay, zero hosting cost
- WebRTC signaling via MQTT public brokers
- STUN (Google, Cloudflare) + TURN (Open Relay) for NAT traversal
- Awareness protocol: live cursors, selections, presence
- Figma-style colored cursor arrows with name pills
- Click peer avatar to follow their viewport, click again to stop
- Stale cursor cleanup on peer disconnect
- Local persistence via y-indexeddb — room survives page refresh
- Share link at `/share/<room-id>` with vue-router
- Secure room IDs via `crypto.getRandomValues()`
- Removed Cloudflare Durable Object relay server (`packages/collab/`)

### UI

- Toast notifications via Reka UI Toast — top-center blue pill for info, red for errors
- Global error handler (window.error + unhandledrejection) shows errors as toasts
- Link copied toast on share and copy link actions
- HsvColorArea extracted as shared component (ColorPicker + FillPicker)
- Scrollable app menu without visible scrollbar
- Selection broadcasting to remote peers

## 0.1.0-alpha (2026-03-01)

First public alpha. The editor is functional but not production-ready.

### Editor

- Canvas rendering via CanvasKit (Skia WASM) on WebGL surface
- Rectangle, Ellipse, Line, Polygon, Star drawing tools
- Pen tool with vector network model (bezier curves, open/closed paths)
- Inline text editing on canvas with phantom textarea for input/IME
- Rich text formatting: bold, italic, underline per-character via style runs
- Font picker with system font enumeration (font-kit on desktop, Local Font Access API in browser)
- Auto-layout via Yoga WASM (direction, gap, padding, justify, align, child sizing)
- Components, instances, component sets with live sync and override preservation
- Variables with collections, modes, color bindings, alias chains
- Undo/redo for all operations (inverse-command pattern)
- Snap guides with rotation-aware edge/center snapping
- Canvas rulers with selection range badges
- Marquee selection, multi-select, resize handles, rotation
- Group/ungroup, z-order, visibility, lock
- Sections with title pills and auto-adoption of overlapping nodes
- Multi-page documents with independent viewport state
- Hover highlight following node geometry (ellipses, rounded rects, vectors)
- Context menu with clipboard, z-order, grouping, component, and visibility actions
- Color picker with HSV, gradients (linear, radial, angular, diamond), image fills
- Properties panel: position, appearance, fill, stroke, effects, typography, layout, export
- ScrubInput drag-to-change number controls
- Resizable side panels via reka-ui Splitter

### File Format

- .fig file import via Kiwi binary codec (194 definitions, ~390 fields)
- .fig file export with Kiwi encoding, Zstd compression, thumbnail generation
- Figma clipboard: copy/paste between OpenPencil and Figma
- Round-trip fidelity for supported node types

### AI Integration

- Built-in AI chat in properties panel (⌘J)
- Direct browser → OpenRouter communication, no backend
- Model selector: Claude, Gemini, GPT, DeepSeek, Qwen, Kimi, Llama
- 10 AI tools: create_shape, set_fill, set_stroke, update_node, set_layout, delete_node, select_nodes, get_page_tree, get_selection, rename_node
- Streaming markdown responses (vue-stream-markdown)
- Tool call timeline with collapsible details

### Code Panel

- JSX export of selected nodes with Tailwind-like shorthand props
- Syntax highlighting via Prism.js
- Copy to clipboard

### CLI (`@open-pencil/cli`)

- `info` — document stats, node types, fonts
- `tree` — visual node tree
- `find` — search by name/type
- `export` — render to PNG/JPG/WEBP at any scale
- `node` — detailed properties by ID
- `pages` — list pages with node counts
- `variables` — list design variables and collections
- `eval` — run scripts with Figma-compatible plugin API
- `analyze colors` — color palette usage
- `analyze typography` — font/size/weight distribution
- `analyze spacing` — gap/padding values
- `analyze clusters` — repeated patterns
- All commands support `--json`

### Core (`@open-pencil/core`)

- Scene graph with flat Map storage and parentIndex tree
- FigmaAPI with ~65% Figma plugin API compatibility
- JSX renderer (TreeNode builder functions with shorthand props)
- Kiwi binary codec (encode/decode)
- Vector network blob encoder/decoder

### Desktop App

- Tauri v2 (~5 MB)
- Native menu bar, save/open dialogs
- System font enumeration via font-kit
- Zstd compression in Rust
- macOS and Windows builds via GitHub Actions

### Web App

- Runs at [app.openpencil.dev](https://app.openpencil.dev)
- No installation required
- File System Access API for save/open (Chrome/Edge), download fallback elsewhere

### Documentation

- [openpencil.dev](https://openpencil.dev) — VitePress site with user guide, reference, and development docs
- Deployed via Cloudflare Pages
