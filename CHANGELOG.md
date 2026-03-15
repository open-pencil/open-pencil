# Changelog

## Unreleased

### Features

- Import Pencil Dev (.pen) files — open via File dialog, drag & drop, CLI, or MCP server
- Design file format router — `.fig` and `.pen` detected by extension, single `readDesignFile()` entry point
- .pen validation tool (`validatePenImport`) for property-by-property import accuracy checks
- CLI headless export loads correct font weights and bundles Material Symbols Sharp for icon fonts

### Performance

- Offload .fig parsing (unzip + Kiwi decode) to a Web Worker — main thread stays responsive during file open
- Offload .fig compression to a Web Worker during save (was blocking 450ms+)
- Add instance index (`componentId → Set<nodeId>`) — `getInstances()` is O(1) instead of scanning all nodes
- Defer graph event subscription until after layout computation during file open — eliminates redundant `syncInstances` calls
- Cache label collection (sections/components) per scene mutation instead of walking the full tree every frame
- Blocking font loading — fonts load before first render to ensure correct glyphs

### Features

- Grid layout in AI chat — JSX renderer supports `grid`, `columns`, `rows`, `gap` props with child positioning (`colStart`, `rowStart`, `colSpan`, `rowSpan`) and auto-height grids
- Configurable max output tokens in AI provider settings (default 16384)
- Z.ai AI provider with GLM-5, GLM-4.7, GLM-4.6, GLM-4.5 model families
- MiniMax AI provider with M2.5, M2.1, M2 models

### Fixes

- Fix text rendering with wrong fonts on file open — all font weights (including default family) are now loaded before the first render
- Fix `weightToStyle` mapping: weight 400 now correctly maps to "Regular" instead of "Medium"
- Fix detached ArrayBuffer crash when switching pages after saving — export worker now copies image buffers before transferring
- Show warning toast when fonts fail to load, error toast when file open fails
- Fix FillPicker crash when selecting image fills (missing `ref` import from #92)
- Fix Google Fonts TLS/network errors not cached — failed families no longer retry on every render
- Fix CJK text garbled when font is unavailable — fallback now renders through paragraph shaper instead of raw `drawText`, preserving CJK characters via the fallback font chain
- Fix auto-layout overflow in AI-generated designs — text wrapping, min/max constraints, absolute positioning, and FILL sizing now work correctly
- Fix `layoutAlignSelf` limited to STRETCH — full range supported (CENTER, MAX, MIN, BASELINE)
- Fix hidden auto-layout children losing their dimensions on layout recompute
- Fix ProviderSettings popover not visible in AI chat
- Fix paste/copy/cut intercepted by canvas in AI chat input
- Strip TypeScript casts from AI-generated JSX (`as any`, `as const`)
- Fix parsing complex .fig files crashing on missing GUIDs in component overrides
- Fix headless text layout using 100×100 default size instead of estimated dimensions
- Fix clipboard roundtrip losing properties — clipsContent, constraints, arcData, strokeCap/Join, layoutAlignSelf, textAutoResize, autoRename now preserved in Figma Kiwi serialization
- Fix MCP headless export crashing on `window.queryLocalFonts` in non-browser runtimes (Bun/Node)
- Fix MCP `export_image` rendering blank text — fonts now loaded before rasterization

## 0.9.0 — 2026-03-09

### Features

- XPath query command — `open-pencil query design.fig "//FRAME[@width < 300]"` to find nodes by type, attributes, and tree structure using XPath selectors
- CSS Grid layout mode — select a frame, click the grid icon in the auto layout toolbar to switch from flex to grid. Configure column/row tracks (fr, fixed px, auto), column and row gaps, and per-side padding. Powered by a [Yoga fork](https://github.com/open-pencil/yoga/tree/grid) with cherry-picked CSS Grid PRs from upstream
- JSX and Tailwind CSS export for grid layouts — `grid grid-cols-N`, `gap-x-*`/`gap-y-*`, child `col-start-*`/`row-start-*`/`col-span-*`/`row-span-*`
- Multi-provider AI support — connect to Anthropic, OpenAI, Google AI, or any OpenAI-compatible endpoint directly, in addition to OpenRouter. Per-provider API key storage, provider settings popover, automatic migration from single OpenRouter key
- Anthropic-compatible provider for custom API endpoints
- New AI tools: `get_jsx` (JSX roundtrip view), `diff_jsx` (structural diff), `describe` (semantic role, visual style, layout, design issues)
- AI visual verification — `export_image` returns image content to the model for vision-based review
- API type toggle (Completions/Responses) for OpenAI-compatible providers
- Figma zoom shortcuts — ⌘0 (100%), ⌘1 (zoom to fit), ⌘2 (zoom to selection), ⇧1/⇧2 alternatives
- XPath query tool — `query_nodes` for AI/MCP with attribute selectors, tree traversal, and type filtering

### Fixes

- Serialize variables, collections, and bindings to `.fig` files — previously lost on save (#65)
- Text nodes created via MCP now render in Figma — emit `derivedTextData` with font metadata and layout size (#64)
- Double-click on layer tree no longer toggles expand/collapse — use the chevron instead
- Page rename input matches layer rename styling
- Fix `w="fill"`/`h="fill"` in JSX renderer — now direction-aware based on parent flex axis
- Fix text auto-resize defaulting to fixed 100×100 — text without explicit width uses `WIDTH_AND_HEIGHT`
- Fix `clipsContent` not propagated to Yoga — frames with clip enabled now set `Overflow.Hidden`
- Fix `COUNTER_ALIGN_MAP` mapping stretch to `MIN` instead of `STRETCH`
- Fix JSX export omitting x/y for absolute-positioned children
- Fix JSX export ignoring `textAutoResize` for text sizing
- Fix drag terminating on mouseleave — drags now continue outside the canvas
- Fix `export_image` stack overflow on large nodes — chunked base64 encoding
- Undo support for auto-layout reorder, layer tree reorder, and drag reparent
- Page snapshot undo for AI tool mutations
- Fix collab sync for same-parent reorder — `node:reordered` events now propagated to Yjs peers
- Fix orphaned instances on clipboard paste — detach to FRAME when component is missing
- Fix text typography lost on Figma clipboard import — preserve fontFamily, fontWeight, fontSize, lineHeight
- Fix `copyFill` missing `gradientTransform` and `imageTransform` — gradient fills now round-trip correctly


### Performance

- Event-driven rendering and component sync — `SceneGraph` emits typed events on mutations; `requestRender()` calls reduced from 94 to 22, component instance sync uses microtask batching with deduplication
- Replace `structuredClone` with typed copy helpers for fills, strokes, effects, and style runs (~24× faster in hot paths)
- Filter .fig unzip to only decompress canvas and image entries, skipping metadata cruft


### Improvements

- Padding on a frame auto-enables vertical auto-layout
- AI tools run `computeAllLayouts` after execution — layout updates immediately
- Enhanced AI system prompt with full JSX prop reference and verification workflow
- Chat panel preserves messages when toggling UI visibility
- SceneGraph event bus (nanoevents) — `node:created`, `node:updated`, `node:deleted`, `node:reparented`, `node:reordered` events replace monkey-patching in collab sync and manual render invalidation
- Replace esbuild-wasm (14 MB) with sucrase (201 KB) for JSX transform — `buildComponent()` and `renderJSX()` now synchronous and browser-compatible
- `useMagicKeys` keyboard shortcut system — replaces tinykeys with VueUse built-in, cross-platform Meta/Control handling, modifier exclusion for combo conflicts
- Dev-only debug toolbar for copying chat logs
- Auto-layout icons in layer tree — vertical (rows), horizontal (columns), and grid icons for auto-layout frames; components keep their purple diamond
- Frame titles on canvas are now draggable — clicking a selected top-level frame's name label starts a drag
- Compact layout controls — icon-based gap (↔/↕) and padding (T/R/B/L) inputs instead of text labels
- Auto-detect horizontal vs vertical direction when wrapping in auto layout (Shift+A)
- Fix alignment grid for vertical layouts — visual positions now match spatial axes
- Fix grid switch from HUG-sized frames — frame expands to fit children
- Remove unwanted white fill when wrapping in auto layout

## 0.8.0 — 2026-03-07

### Features

- Mobile layout & PWA — responsive editor with touch-optimized toolbar, swipeable bottom drawer (layers/properties/design/code), HUD overlay, and installable PWA with icons and service worker
- Tailwind CSS v4 JSX export — export selections as HTML with Tailwind utility classes (`<div className="flex gap-4 p-3">`) from the Code panel, CLI (`bun open-pencil export --format jsx --style tailwind`), or programmatically via `sceneNodeToJSX(id, graph, 'tailwind')`. Supports layout, sizing, colors, border radius, opacity, rotation, overflow, shadows, blur, and typography. Uses v4 spacing semantics (px/4 multiplier) with automatic fallback to arbitrary values.
- Code panel format toggle — switch between OpenPencil (custom components) and Tailwind (HTML + utility classes) output
- Homebrew tap — `brew install open-pencil/tap/open-pencil` for macOS (arm64 + x64), auto-updated on each release
- Double-click to rename layers — inline rename in layer panel, shared `useInlineRename` composable
- New AI/MCP tools: `analyze_colors`, `analyze_typography`, `analyze_spacing`, `analyze_clusters`, `diff_create`, `diff_show`, `get_components`, `get_current_page`, `arrange`, `node_to_component`
- CLI-to-app RPC bridge — all CLI commands work against the running app when no file is specified. Start the app, then run `bun open-pencil tree` to inspect the live document
- VitePress docs site — user guide, reference, architecture, and development docs at openpencil.dev with 6 locales (en, de, fr, es, it, pl), SEO (OG tags, hreflang, JSON-LD, sitemap), and dark theme

### Improvements

- Refactor mobile drawer tabs, layout sizing dropdowns, and inline rename to use Reka UI primitives
- Add shared UI style helpers with tailwind-variants for menus, selects, buttons, and surfaces
- Unified tool definitions — define once in `packages/core/src/tools/`, automatically available in AI chat, CLI, and MCP
- Harden FigmaAPI — hide internals via Symbols, freeze arrays, fix `layoutSizing`, 30+ new properties and methods
- Split tools into domain files (read, create, modify, structure, variables, vector, analyze) — easier to navigate and extend
- Replace inline type definitions with named types (`Color`, `Vector`, `SceneNode`) across the codebase
- Split 3200-line `renderer.ts` into `packages/core/src/renderer/` with 10 focused files (scene, overlays, fills, strokes, shapes, effects, rulers, labels)
- Centralize all color utilities in `packages/core/src/color.ts` — `colorToHex8`, `colorToCSSCompact`, `normalizeColor`, `colorDistance`; remove 5 duplicate implementations across the codebase
- Add `geometry.ts` with shared rotation math (`degToRad`, `radToDeg`, `rotatePoint`, `rotatedCorners`, `rotatedBBox`)
- Extract `isArrayMixed()` helper for multi-selection property panels

### Fixes

- Fix drawer animation jump on close — single spring transition instead of two-phase
- Fix `ALL_TOOLS` registry missing newer tools (`analyzeColors`, `diffCreate`, `exportImage`, `arrangeNodes`)
- Fix `renderJSX` typo in tool definitions (`renderJsx` → `renderJSX`)
- Fix all oxlint warnings and tsgo errors — replace `!` non-null assertions in `use-collab.ts` with local const captures
- Fix broken test imports — stale `../../src/engine/` paths updated to `@open-pencil/core`
- Fix flaky E2E tests: layers panel navigates to `/demo`, zoom-to-fit test zooms in first, snapshot rendering stabilized with `workers: 1` and `colorScheme: dark`
- Fix bogus .fig import mappings for `expanded` and `strokeMiterLimit` fields
- Fix PWA manifest error in dev mode, handle invalid font data gracefully
- Fix eval response unwrapping and `export_jsx` page selection in RPC bridge
- Fix automation commands not recomputing layouts after mutations
- Fix workspace dependency not resolved when installing from npm (switch CI to pnpm publish)

### Internal

- Add `motion-v` for declarative animations — used in mobile drawer (spring-animated height with pan gestures) and toolbar (layout-animated category switching with directional slide transitions)
- Mobile drawer: replace `useSwipe` + manual rAF animation with `motion.div` `:animate` + `@pan`/`@panEnd`; always-on tab state (no more null `activeRibbonTab`); content stays rendered when closed
- Mobile toolbar: replace manual `scrollWidth` measuring + inline CSS transitions with `motion.div layout` + `AnimatePresence` directional slide variants
- Mobile UI cleanup: extract shared `colorToCSS` util to core, `initials` to `src/utils/text`, `toolIcons` to `src/utils/tools`; replace hand-rolled dropdowns with reka-ui Popover/DropdownMenu; narrow `mobileDrawerSnap` type to string union; move magic numbers to constants; disable PWA service worker in dev mode
- 83 new E2E tests (57 → 140): design panel, code panel, components, copy/paste, multi-page, text editing, keyboard shortcuts, context menu
- 150 new unit tests (588 → 738): color, undo, snap, vector, style-runs, text-editor
- 48 new E2E tests (9 spec files) + 26 mutation unit tests + store/canvas test helpers
- Add `data-test-id` attributes to AppearanceSection, LayoutSection, TypographySection, VariablesDialog, EditorView

## 0.7.0 — 2026-03-05

### Features

- SVG export — export selections as SVG from the export panel, context menu, CLI (`bun open-pencil export --format svg`), or MCP/AI tools (`export_svg`). Supports rectangles, ellipses, lines, stars, polygons, vectors, text with style runs, gradients, image fills, effects, blend modes, clip paths, and nested groups (#46)
- Copy/Paste as submenu in context menu — Copy as text, Copy as SVG, Copy as PNG (⇧⌘C), Copy as JSX
- Stroke align (Inside/Center/Outside) with clip-based rendering matching Figma behavior
- Individual stroke weights per side (Top/Right/Bottom/Left) with side selector dropdown
- Google Fonts fallback — automatically loads fonts from Google Fonts API when not available locally
- Auto-save toggle in File menu — disable to prevent automatic writes to the opened .fig file
- Renderer profiler with in-canvas HUD overlay, GPU timing, and phase instrumentation

### Improvements

- Replace custom color picker with Reka UI Color components (ColorArea, ColorSlider, ColorField) — adds keyboard navigation and accessibility to the color area, hue, and alpha controls

### Fixes

- CJK text rendering — load a system CJK font (PingFang SC, Microsoft YaHei, Noto Sans CJK) as fallback; falls back to Noto Sans SC from Google Fonts when no system font is available (#48)
- Font registration errors no longer cache invalid font data — `loadFont` only caches after successful CanvasKit registration
- Fix `render` tool failing on Windows + Bun with "Cannot find module" error (#43)
- Fix hover highlighting nodes from internal component pages — scope hit-test to current page
- Fix hit-testing on transparent frames and groups — empty containers without fills or strokes are now click-through, clipping parents reject hits outside their bounds, matching Figma behavior
- Fix instance overrides on .fig import and clipboard paste — resolve guidPaths by overrideKey, handle component swaps (`overriddenSymbolID`), propagate through nested clone chains. Import and paste now share a single override engine.
- Apply Figma component property assignments on import — boolean visibility toggles and instance swaps via `componentPropRefs`/`componentPropAssignments`
- Apply `derivedSymbolData` sizes on import — containers now shrink correctly when component properties hide children
- Fix override resolution for nested instance targets — check the current node before searching descendants
- Fix component property assignments for nested instances — resolve scoped `componentPropAssignments` inside `symbolOverrides` via guidPath, handle `guidValue` for instance swaps, reorder phases so transitive sync doesn't clobber visibility
- Pixel-perfect vector rendering using pre-computed `fillGeometry`/`strokeGeometry` blobs from .fig files — eliminates white gaps between adjacent stroked shapes
- Stroke outlines on clipboard paste — convert vectorNetwork paths to filled outlines via CanvasKit when geometry blobs are unavailable
- Apply `derivedSymbolData` transforms and geometry during import — instance children render at correct scale and position
- Fix internal pages becoming visible after .fig round-trip — preserve `internalOnly` flag on export
- Scope layout recomputation to current page for paste/undo/font-load (major speedup on large multi-page files)
- Show loading overlay until all document fonts are loaded (no more partially rendered text)
- Load fonts when switching pages (previously only loaded for the first page)
- Always show visibility toggle on fill, stroke, and effect rows (matches Figma)
- Fix renderer crash on double destroy when closing files quickly
- Fix .fig page ordering — use deterministic byte comparison for fractional index positions
- Fix text truncation using `textTruncation` field instead of `textAutoResize`
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
- ACP agent package — Agent Communication Protocol server for AI coding tools, reusing core ToolDefs

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
