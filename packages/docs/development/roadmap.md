# Roadmap

## Phases

### Phase 1: Core Engine ✅

SceneGraph, Skia rendering, basic shapes, selection, zoom/pan, undo/redo.

**Delivered:**
- Scene graph with flat Map storage and parent-child tree
- CanvasKit WASM rendering for all shape types
- Click/shift/marquee selection with resize handles and rotation
- Zoom/pan with keyboard shortcuts and trackpad gestures
- Undo/redo wired into all operations
- Snap guides with edge and center snapping

### Phase 2: Editor UI + Layout ✅

Properties panel, layers panel, toolbar, Yoga layout integration, text editing.

**Delivered:**
- Vue 3 + Reka UI panels (properties, layers, toolbar)
- Properties panel split into sections (Appearance, Fill, Stroke, Typography, Layout, Position)
- ScrubInput component for all numeric inputs
- Color picker (HSV, hex, opacity)
- Layers panel with tree view, drag reorder, visibility toggle
- Auto-layout with Yoga WASM (direction, gap, padding, justify, align)
- Inline text editing with CanvasKit Paragraph API
- System font loading via Local Font Access API
- Canvas rulers with selection highlight

### Phase 3: File I/O + Visual Features ✅

.fig import/export, Kiwi codec, clipboard, sections, pages, advanced rendering.

**Delivered:**
- .fig file import via Kiwi binary codec
- .fig file export with Kiwi encoding, Zstd compression, thumbnail generation
- Save (⌘S) and Save As (⇧⌘S) with native OS dialogs
- Zstd compression via Tauri Rust command (deflate fallback in browser)
- Vendored kiwi-schema with ESM + sparse field ID patches
- Figma-compatible clipboard (bidirectional fig-kiwi binary)
- Pen tool with vector network model
- vectorNetworkBlob binary encode/decode
- Group/ungroup (⌘G/⇧⌘G)
- Tauri v2 desktop app with native menu bar (macOS/Windows/Linux)
- Sections (S key) with title pills, auto-adopt, luminance-adaptive text
- Multi-page documents with pages panel, per-page viewport
- Hover highlight with shape-aware outlines
- Tier 1 rendering: gradients, image fills, effects, strokes (cap/join/dash), arcs
- Fill type picker with solid/gradient/image tabs and gradient stop editing
- Canvas background color per page
- Fig-import unit tests, layout unit tests, layers-panel E2E tests

### Phase 4: Components + Variables ✅

Components, instances, overrides, variables, collections, modes, image export.

**Delivered:**
- Component creation from frame/group or multi-selection (⌥⌘K)
- Component sets from multiple components (⇧⌘K) with dashed purple border
- Instance creation from components with child cloning and componentId mapping
- Live component-instance sync with override preservation
- Detach instance back to frame (⌥⌘B)
- Go to main component (cross-page navigation)
- Always-visible purple component/instance labels with diamond icon
- Opaque container hit testing (click selects component, double-click enters)
- Right-click context menu with clipboard, z-order, grouping, component, visibility, lock, move-to-page actions
- Z-order manipulation (] bring to front, [ send to back)
- Toggle visibility (⇧⌘H) and lock (⇧⌘L)
- Move nodes between pages via context menu
- Viewport culling, Paint reuse, RAF render coalescing
- Effects panel UI (drop shadow, inner shadow, layer/background/foreground blur)
- Independent corner radius controls (per-corner toggle in Appearance section)
- GitHub Actions CI/CD for Windows (x64, arm64) and macOS (x64, arm64) builds
- Polygon and Star drawing tools with pointCount and starInnerRadius
- Resizable left/right panels via reka-ui Splitter (persistent layout)
- @/ import alias, shared types module (src/types.ts, src/global.d.ts)
- Codebase lint-clean: 0 oxlint warnings, 0 tsgo type errors
- Variables: COLOR type with collections, modes, bindings, FillSection variable picker, .fig import
- Variables dialog: TanStack Table with resizable columns, mode columns, collection tabs with rename, search, demo collections (Primitives/Semantic/Spacing), undo/redo for all variable operations
- Image export: PNG/JPG/WEBP with ExportSection (scale, format, live preview), ⇧⌘E shortcut, context menu
- Canvas-native text editing: TextEditor class in core, phantom textarea, cursor/selection/word boundaries on canvas, caret blinking, selection highlights
- System font enumeration via font-kit Rust crate, OnceLock cache, preload on startup
- Font picker: virtual scroll (reka-ui ListboxVirtualizer), search filter, CSS font preview
- ColorInput component extraction, ColorPicker alpha slider checkerboard fix
- App identity: pencil icon, Cargo crate open_pencil, macOS Dock "OpenPencil"
- Splash loader during WASM initialization
- Rich text style runs: per-selection ⌘B/I/U, StyleRun model, ParagraphBuilder pushStyle/pop, .fig roundtrip
- B/I/U/S toggle buttons in TypographySection
- Double-click (word), triple-click (select all) text selection

**Remaining (deferred to Phase 6):**
- Variant switching
- Variable types: FLOAT, STRING, BOOLEAN editing UI
- Variable-driven theming

### Phase 5: AI Integration & Tooling 🟡

Core extraction, CLI, MCP server, design guidelines, screenshot verification loop.

**Delivered:**
- @open-pencil/core extracted to packages/core/ (zero DOM deps, Bun workspace)
- @open-pencil/cli with headless .fig operations (info, tree, find, export, analyze, node, pages, variables), CanvasKit CPU rasterization, --json output
- JSX renderer: TreeNode builders (Frame, Text, Rectangle, etc.), renderTreeNode/renderJsx, Tailwind-like shorthand props, 27 tests
- jscpd copy-paste detection (15.6% → 0.62%), kiwi-serialize.ts consolidation
- .fig roundtrip tests with LFS fixtures (material3.fig 87K nodes, nuxtui.fig 314K nodes)
- .fig import O(n²) → O(n) fix (37s → 535ms on 87K nodes), ByteBuffer optimization
- test:coverage script
- AI chat: OpenRouter direct (no backend), Stronghold key storage, 38 tools (create_shape, set_fill, set_effects, set_constraints, components, groups, pages, variables, eval_code, etc.), model selector, ⌘J toggle, streaming markdown, Playwright tests with mock transport
- Code panel: sceneNodeToJsx() export, Prism.js highlighting, line numbers, copy button, 14 tests
- Properties panel restructured: Design | Code | AI tabs
- npm publishing preparation for core and cli packages

**Planned:**
- Port remaining figma-use tools (118 total, 26 currently implemented)
- Attached mode: WebSocket to running editor for eval, create, export, screenshot
- Design guidelines system
- AI-driven design workflow via MCP
- Screenshot verification loop

### Phase 6: Polish + Distribution 🔲

Prototyping, comments, desktop distribution, documentation, public launch.

**Planned:**
- Prototyping (frame connections, transitions)
- Comments (pin, threads, resolve)
- Linux Tauri builds (macOS and Windows already covered by CI)
- PWA support
- Documentation site (VitePress)
- Performance optimization (Lighthouse > 90)
- Full Figma compatibility test suite
- Deferred from Phase 4: variant switching, FLOAT/STRING/BOOLEAN variable UI, variable-driven theming

## Timeline

| Phase | Estimated Duration | Status |
|-------|-------------------|--------|
| Phase 1: Core Engine | 3 months | ✅ Complete |
| Phase 2: Editor UI + Layout | 3 months | ✅ Complete |
| Phase 3: File I/O + Visual Features | 2 months | ✅ Complete |
| Phase 4: Components + Variables | 2 months | ✅ Complete |
| Phase 5: AI Integration & Tooling | 2 months | 🟡 In Progress |
| Phase 6: Polish + Distribution | 2 months | 🔲 Planned |
