# Changelog

## Unreleased

### Features

- Demo recording infrastructure — `packages/demos` with webreel for scripted browser demo capture (`bun run demo`, `demo:list`, `demo:preview`)

### Fixes

- Fix horizontal scrollbar on design and pages panels
- Style scrollbars for Tauri (thin dark overlay instead of default OS chrome)
- Enable file watcher in Tauri — `watch` feature was missing from `tauri-plugin-fs`

## 0.6.0 — 2026-03-04

### Features

- Multi-selection properties panel — edit position, size, appearance, fill, stroke, and effects across multiple selected nodes
- Shared values display normally, differing values show "Mixed"
- W/H inputs in multi-selection mode
- Flip horizontal/vertical using scale transform instead of rotation
- Single-node alignment aligns to parent frame bounds

### Build

- Apple code signing and notarization for macOS builds
- Git LFS storage moved from GitHub to Cloudflare R2


### Fixes

- Fix Figma clipboard paste: extract shared kiwi→SceneNode conversion, fixing broken auto-layout, missing gradient/image fills, effects, style runs, and text properties
- Fix vector rendering on paste — scale path coordinates from Figma's normalizedSize to actual node bounds
- Fix pasted instances having no children — populate from component via symbolData when both are in clipboard
- Detect component sets on import — promote FRAME nodes with VARIANT componentPropDefs to COMPONENT_SET
- Skip internal canvas on paste — components on Figma's hidden internal page populate instances but are not pasted as visible nodes
- Apply instance overrides on paste — text content, fills, visibility, layoutGrow, and textAutoResize from symbolOverrides
- Fix auto-layout child ordering — sort by geometric position instead of z-order position strings
- Load fonts on paste and .fig import — collect font families from text nodes and load into CanvasKit
- Text measurement in auto-layout — use CanvasKit paragraph metrics for WIDTH_AND_HEIGHT text nodes
- Recompute layouts after font loading completes
- Fix PERCENT line height conversion — was stored as raw value instead of pixels
- Fix InvalidCharacterError when copying nodes with non-ASCII text
- Load all font weight/style variants needed by pasted text nodes
- Fix font loading not registering in core cache
- Fix halfLeading applied to text measurement — enable only for rendering
- Clear hover on zoom/pinch to keep scene picture cache valid
- Fix flip buttons using rotation math instead of actual mirroring
- Fix flip transform encoding — scale first matrix column only (was incorrectly producing 180° rotation)
- Decode flip state from .fig transform matrix on import

## 0.5.1 — 2026-03-03

### Fixes

- Fix File → Save crash when document has layer blur effects

## 0.5.0 — 2026-03-03

### Features

- Effects rendering: drop shadow, inner shadow, shadow spread, layer blur, background blur, foreground blur
- Text shadows render on glyphs instead of bounding box
- Multi-file tabs — open multiple documents in tabs within a single window
- Tab bar with close buttons, middle-click to close, and new tab (+) button
- Keyboard shortcuts: ⌘N/⌘T new tab, ⌘W close tab, ⌘O opens in new tab
- Native Tauri menu: File → New and File → Close Tab wired to tab actions
- Render text from SkPicture cache when fonts are missing — pixel-perfect display without the font installed
- Missing font indicator (⚠) next to font picker in the sidebar
- Right-click context menu on layers panel — same actions as the canvas context menu
- 40+ new AI/MCP tools ported from figma-use:
  - Granular set tools: `set_rotation`, `set_opacity`, `set_radius`, `set_minmax`, `set_text`, `set_font`, `set_font_range`, `set_text_resize`, `set_visible`, `set_blend`, `set_locked`, `set_stroke_align`
  - Node operations: `node_bounds`, `node_move`, `node_resize`, `node_ancestors`, `node_children`, `node_tree`, `node_bindings`, `node_replace_with`
  - Variable CRUD: `get_variable`, `find_variables`, `create_variable`, `set_variable`, `delete_variable`, `bind_variable`
  - Collection CRUD: `get_collection`, `create_collection`, `delete_collection`
  - Boolean operations: `boolean_union`, `boolean_subtract`, `boolean_intersect`, `boolean_exclude`
  - Vector path tools: `path_get`, `path_set`, `path_scale`, `path_flip`, `path_move`
  - Create tools: `create_page`, `create_vector`, `create_slice`
  - Viewport: `viewport_get`, `viewport_set`, `viewport_zoom_to_fit`, `page_bounds`
  - Misc: `flatten_nodes`, `list_fonts`
- `set_text_properties` tool: alignment, auto-resize, decoration
- `set_layout_child` tool: sizing, grow, align_self, positioning
- 13 MCP server integration tests via `InMemoryTransport`

### UI

- Resizable pages/layers split in left panel with reka-ui Splitter
- Layers tree auto-expands and scrolls to reveal selected node
- Loading overlay on canvas while opening .fig files
- Hide internal-only pages (e.g. "Internal Only Canvas" in design systems)
- Render page dividers — pages named with only dashes/asterisks/spaces show as horizontal lines
- Only show component labels for COMPONENT and COMPONENT_SET, not instances
- Replace all native `<select>` dropdowns with reka-ui `AppSelect` component
- Smoother trackpad pinch-to-zoom with `Math.exp` curve and deltaMode normalization
- Fix font picker dropdown truncating long font names
- Show explanation in font picker when Local Font Access API unavailable (Safari/Firefox)

### Fixes

- Fix drop shadow rendering on top of fills — shadow now draws behind opaque content
- Fix effect property changes not recorded in undo/redo history
- Fix active tab text invisible against same-color background
- Fix clipboard "Outside int range" error — `pasteID` used unsigned int exceeding Kiwi's signed 32-bit field
- Error toasts are now sticky (don't auto-dismiss), with selectable text, copy button, and close button
- Truncate long node names in export button

### Performance

- Per-node SkPicture cache for effect rendering — unchanged shadow/blur nodes replay from cache on scene redraws
- Drop shadows use `MaskFilter` direct draw instead of `saveLayer` offscreen buffers
- Cached `ImageFilter`, `MaskFilter`, reusable effect paint — zero per-frame WASM allocations for effects
- Reuse GL context on panel resize — swap surface without recreating renderer, preserving all caches
- Per-frame absolute position cache — avoids repeated parent-chain walks during rendering
- Optimize zoom/pan smoothness with `shallowReactive`, `useRafFn`, and input coalescing

### Build

- Auto-populate GitHub Release notes from CHANGELOG.md via `ffurrer2/extract-release-notes@v2`
- Skip already-published npm versions on CI re-runs instead of failing
- Exclude non-app directories from Vite file watcher

### Internal

- Extract shared color constants (`BLACK`, `TRANSPARENT`, `DEFAULT_SHADOW_COLOR`) — replaces 8 inline literals across core
- Extract shared `NodeContextMenuContent` component to avoid menu duplication
- Fix `@open-pencil/core` dep in MCP package: `workspace:*` for local dev (pnpm resolves at publish time)
- Replace store thunks with a late-binding proxy

### Tests

- Clipboard roundtrip tests: encode to Figma Kiwi binary → decode → verify
- 9 visual regression snapshot tests for effects rendering
- Zoom/pan E2E tests and pipeline benchmark
- MCP server edge-case tests for `find_nodes` and Zod validation
- 6 unit tests for absolute position cache

## [0.4.2] (2026-03-02)

### Fixes

- Fix Figma clipboard paste: skip non-visual node types (variables, widgets, stickies, connectors)
- Fix text not rendering after paste — `letterSpacing` from Figma is a `{value, units}` object, was passed as-is → `NaN` broke CanvasKit paragraph layout
- Fix undo/redo for Figma paste — no undo entry was recorded; redo duplicated `childIds`
- Center pasted Figma content in viewport instead of using original coordinates
- Compute auto-layouts after clipboard paste (same as .fig import and demo creation)

### Improvements

- Import additional properties from Figma clipboard: `layoutAlignSelf`, `clipsContent`, `fontWeight`, `italic`, `letterSpacing`, `lineHeight`
- Convert `letterSpacing` PERCENT units to pixels based on font size

### Tests

- 7 new clipboard import unit tests (14 total)

## [0.4.1] (2026-03-02)

### Fixes

- Fix text disappearing after hover when SkPicture cache was recorded before fonts loaded
- Invalidate scene picture cache on font load to prevent stale fallback text

### Docs

- Highlight copy & paste with Figma in README and feature docs
- Replace "fig-kiwi" format name with "Kiwi binary" — the format is shared between .fig files and clipboard

## [0.4.0] (2026-03-02)

### Features

- MCP server (`@open-pencil/mcp`) — 29 tools for headless .fig editing via stdio (Claude Code, Cursor, Windsurf) or HTTP (Hono + Streamable HTTP with sessions)
- `openpencil-mcp` and `openpencil-mcp-http` binaries — install globally via `bun add -g @open-pencil/mcp`

### Build

- All packages emit JS via tsgo + fix-esm-import-path — `@open-pencil/core` and `@open-pencil/mcp` work on Node.js without Bun
- Core package exports: `bun` condition → src (dev), `import` condition → dist (npm consumers)
- `@open-pencil/mcp` added to CI publish workflow

## [0.3.2] (2026-03-02)

### Performance

- Re-apply SkPicture scene caching for ~7x faster pan/zoom (0.98ms vs 6.8ms per frame at 500 nodes)

### Tests

- Visual regression tests for SkPicture cache: hover on/off cycle, multiple cycles, mouse hover, scene change + hover
- Type `window.__OPEN_PENCIL_STORE__` globally, remove ad-hoc casts from tests

## [0.3.1] (2026-03-02)

### Fixes

- Fix text disappearing after hovering a frame (revert SkPicture scene caching)
- Fix macOS startup hang: async font loading, show window on reopen

## [0.3.0] (2026-03-01)

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

## [0.2.1] (2026-03-01)

### UI

- Panel header with app logo, editable document name, and sidebar toggle
- ⌘\\ to toggle side panels for distraction-free canvas
- Panels hidden by default on mobile (< 768px)
- Floating bar with logo, filename, and restore button when panels hidden
- Always show local user avatar in collab header
- Touch support for pan and pinch-zoom on iOS

### Performance

- Stubbed shiki to remove 9MB of unused language grammars (20MB → 11MB bundle)

## [0.2.0] (2026-03-01)

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

## [0.1.0-alpha] (2026-03-01)

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
