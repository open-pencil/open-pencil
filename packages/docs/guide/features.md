# Features

## Why OpenPencil

Design tools are a supply chain problem. When your tool is closed-source, the vendor controls what's possible — they can break your automation overnight. OpenPencil is an open-source alternative: MIT-licensed, Figma-compatible, fully local, and programmable.

## Figma .fig File Import & Export

Open and save native Figma files directly. Import decodes the full 194-definition Kiwi schema including NodeChange messages with ~390 fields. Export encodes the scene graph back to Kiwi binary with Zstd compression and thumbnail generation. Save (<kbd>⌘</kbd><kbd>S</kbd>) and Save As (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd>) use native OS dialogs on the desktop app. The import/export pipeline supports round-trip fidelity.

## Copy & Paste with Figma

Select nodes in Figma, <kbd>⌘</kbd><kbd>C</kbd>, switch to OpenPencil, <kbd>⌘</kbd><kbd>V</kbd> — they appear with fills, strokes, auto-layout, text, corner radii, effects, and vector networks preserved. Works the other way too: copy from OpenPencil, paste into Figma.

Under the hood, both directions use the same Kiwi binary format as .fig files — Figma base64-encodes it into HTML on the clipboard. OpenPencil decodes the full schema on paste (194 definitions, ~390 fields per NodeChange) and encodes it on copy. Vector data round-trips through the `vectorNetworkBlob` binary format. Also works between OpenPencil instances via a separate native clipboard format.

Paste handles complex scenarios: vector paths are scaled from Figma's `normalizedSize` to actual node bounds, instance children are populated from their component's `symbolData`, component sets are detected by promoting frames with variant `componentPropDefs`, internal canvas nodes are skipped, and `symbolOverrides` are applied for text, fills, visibility, and layout properties. Fonts referenced by pasted text nodes are automatically loaded.

## Vector Networks

The pen tool uses Figma's vector network model — not simple paths. Click to place corner points, click+drag for bezier curves with tangent handles. Supports open and closed paths. Vector data uses the same `vectorNetworkBlob` binary format as Figma.

## Shape Tools

The toolbar provides all basic Figma shape tools: Rectangle (<kbd>R</kbd>), Ellipse (<kbd>O</kbd>), Line (<kbd>L</kbd>), Polygon, and Star. Polygon and Star are in the shapes flyout — click and hold the Rectangle tool to access them. Polygon draws regular polygons (default 3 sides) using a `pointCount` property. Star draws pointed stars (default 5 points) with a configurable `starInnerRadius` (default 0.38). All shapes support fill, stroke, hover highlight, and selection outline.

## Auto-Layout

Yoga WASM provides CSS flexbox layout. Frames support:

- **Direction** — horizontal, vertical, wrap
- **Gap** — spacing between children
- **Padding** — uniform or per-side
- **Justify** — start, center, end, space-between
- **Align** — start, center, end, stretch
- **Child sizing** — fixed, fill, hug

Shift+A toggles auto-layout on a frame or wraps selected nodes.

## Inline Text Editing

Canvas-native text editing — no DOM textarea overlay on screen. A `TextEditor` class in `@open-pencil/core` handles cursor positioning, text selection, word boundary detection, and line navigation using the CanvasKit Paragraph API (`getGlyphPositionAtCoordinate`, `getRectsForRange`, `getLineMetrics`). A hidden phantom textarea captures keyboard input, IME composition, and clipboard events.

Double-click a text node to enter edit mode. The canvas renders a blinking caret, translucent blue selection rectangles, and a blue outline around the node. Click and drag to select text, double-click a word to select it, triple-click to select all. Keyboard navigation with modifier support: <kbd>⌥</kbd><kbd>←</kbd>/<kbd>→</kbd> for word movement, <kbd>⌘</kbd><kbd>←</kbd>/<kbd>→</kbd> for line start/end, <kbd>⌥</kbd><kbd>⌫</kbd> for word delete, <kbd>⌘</kbd><kbd>⌫</kbd> for line delete. Shift extends selection. <kbd>Esc</kbd> or clicking outside commits the edit.

**Font picker** with virtual scroll (reka-ui ListboxVirtualizer), search filter, and CSS font preview — each font name renders in its own typeface. In Tauri, system fonts are enumerated via Rust `font-kit` crate (`list_system_fonts`/`load_system_font` commands) with OnceLock caching for instant picker access. In browser, the Local Font Access API is used when available.

## Rich Text Formatting

Per-character formatting within a single text node. Select text and press <kbd>⌘</kbd><kbd>B</kbd> for bold, <kbd>⌘</kbd><kbd>I</kbd> for italic, <kbd>⌘</kbd><kbd>U</kbd> for underline, or use the B/I/U/S buttons in the Typography section. With no selection, the shortcut toggles the whole-node style.

Implemented via a StyleRun model — an array of `{start, length, style}` segments where style includes fontWeight, italic, and textDecoration. The renderer uses CanvasKit ParagraphBuilder.pushStyle/pop to render mixed formatting in a single paragraph. Style runs adjust automatically on insert and delete to preserve formatting boundaries.

Rich text formatting is preserved during .fig import/export — `characterStyleIDs` and `styleOverrideTable` from Figma's TextData are imported as StyleRun arrays and exported back with a deduped style table.

## Undo/Redo

Every operation is undoable — node creation/deletion, moves, resizes, property changes, reparenting, layout changes, and all variable operations (create/delete/rename variables, create/rename collections, color and value changes). The system uses an inverse-command pattern — before applying any change, it snapshots affected fields. The snapshot becomes the inverse. <kbd>⌘</kbd><kbd>Z</kbd> undoes, <kbd>⇧</kbd><kbd>⌘</kbd><kbd>Z</kbd> redoes.

## Snap Guides

Edge and center snapping with red guide lines when nodes align. Rotation-aware — snap calculations use actual visual bounds of rotated nodes. Coordinates are computed in absolute canvas space.

## Canvas Rulers

Rulers at the top and left edges show coordinate scales. When you select a node, rulers highlight its position with a translucent band and show coordinate badges at the start/end points.

## Color Picker & Fill Types

HSV color selection with hue slider, alpha slider, hex input, and opacity control. The fill type picker provides tabs for Solid, Gradient (Linear, Radial, Angular, Diamond), and Image. Switching to a gradient type shows an editable gradient stop bar. Gradient transforms position the gradient within the shape. Connected to fill and stroke sections in the properties panel.

## Layers Panel

Tree view of the document hierarchy using Reka UI Tree component. Expand/collapse frames, drag to reorder (changes z-order), toggle visibility per node.

Both the layers panel and properties panel are resizable — drag the edge between panels and canvas to adjust width (default 15%, range 10–30%). Layout persists across reloads.

## Properties Panel

Tabbed interface with **Design** | **Code** | **AI** tabs (reka-ui Tabs).

The **Design** tab is context-sensitive with sections:

- **Appearance** — opacity, corner radius (uniform or per-corner with independent toggle), visibility
- **Fill** — solid/gradient/image type picker, gradient stop editor, hex input, opacity
- **Stroke** — color, weight, opacity, cap, join, dash pattern
- **Effects** — add/remove effects, type picker (drop shadow, inner shadow, layer blur, background blur, foreground blur), inline expanded controls (offset, blur, spread, color for shadows; blur radius for blurs), per-effect visibility toggle
- **Typography** — font family (FontPicker with virtual scroll and search), weight, size, alignment, B/I/U/S buttons
- **Layout** — auto-layout controls when enabled
- **Position** — alignment buttons, rotation, flip
- **Export** — scale, format (PNG/JPG/WEBP), live preview, multi-export
- **Page** — canvas background color (shown when no nodes selected)

The **Code** tab shows JSX export of the selection (see [Code Panel](#code-panel)). The **AI** tab provides an AI chat interface (see [AI Chat](#ai-chat)).

## Group/Ungroup

⌘G groups selected nodes. ⇧⌘G ungroups. Nodes are sorted by visual position when grouping to preserve reading order.

## Sections

Sections (<kbd>S</kbd>) are top-level organizational containers on the canvas. Each section displays a title pill with the section name. Title text color automatically inverts based on the pill's background luminance for readability. Creating a section auto-adopts overlapping sibling nodes. Frame name labels are shown for direct children of sections.

## Multi-Page Documents

Documents support multiple pages like Figma. The pages panel lets you add, delete, and rename pages. Each page maintains independent viewport state (pan, zoom, background color). Double-click a page name to rename inline.

## Hover Highlight

Nodes highlight on hover with a shape-aware outline that follows the actual geometry — ellipses get elliptical outlines, rounded rectangles get rounded outlines, vectors get path outlines. This provides visual feedback before clicking to select.

## Advanced Rendering (Tier 1)

The CanvasKit renderer supports full Tier 1 visual features for Figma rendering parity:

- **Gradient fills** — linear, radial, angular, diamond with gradient stops and transforms
- **Image fills** — decoded from blob data with scale modes (fill, fit, crop, tile)
- **Effects** — drop shadow, inner shadow, layer blur, background blur, foreground blur
- **Stroke properties** — cap (none, round, square, arrow), join (miter, bevel, round), dash patterns
- **Arc data** — partial ellipses with start/end angle and inner radius (donuts)
- **Viewport culling** — off-screen nodes are skipped during rendering
- **Paint reuse** — Skia Paint objects are recycled across frames instead of reallocated
- **RAF coalescing** — multiple render requests within one frame are batched into a single `requestAnimationFrame` call

## Components & Instances

Create reusable components from frames or selections (<kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd>). A single frame converts in-place to a COMPONENT; multiple nodes wrap in a new component. Combine multiple components into a COMPONENT_SET (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd>) with a dashed purple border. Create instances from components via context menu — instances copy the component's visual properties and deep-clone children with `componentId` mapping. Detach an instance back to a frame with <kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd>. "Go to main component" navigates to and selects the source component, switching pages if needed.

**Live sync:** Editing a main component propagates changes to all its instances automatically. The store triggers sync after property updates, moves, and resizes. Synced properties include size, fills, strokes, effects, opacity, corner radii, layout, and clipsContent. Instance children are matched to component children via `componentId`.

**Override support:** Instances maintain an overrides record. Properties marked as overridden are preserved during sync — if you customize an instance child's text, it won't be overwritten when the component changes. New children added to a component appear in all existing instances.

Components and instances display always-visible purple labels with a diamond icon showing the node name. They act as opaque containers for selection — clicking selects the component itself, double-clicking enters it to select children.

## Variables

Design tokens as variables with collections and modes. Open the variables dialog from the Variables section in page properties (settings icon). The dialog uses TanStack Table (`@tanstack/vue-table`) with resizable columns — Name | Mode 1 | Mode 2 | ... — matching Figma's table layout. Collection tabs with double-click to rename, search bar, and "+ Create variable" button. Color variables show inline ColorInput with picker.

Supports COLOR type with full UI, FLOAT/STRING/BOOLEAN types defined. Organize variables in collections (e.g., "Primitives", "Semantic"), define modes (e.g., Light/Dark), switch active mode. Bind variables to fill colors via the variable picker in Fill — bound fills show a purple badge with the variable name and a detach button. Alias chains (one variable references another) with cycle detection. All variable operations are undoable: create/delete variable, create collection, rename, color change.

The demo document includes three collections: Primitives (9 colors with Light/Dark modes), Semantic (aliases to Primitives), and Spacing (8 number tokens with Default/Compact modes). Variables are bound to demo nodes for live preview.

## Image & SVG Export

Export selected nodes as PNG, JPG, WEBP, or SVG. The Export section in the properties panel provides scale selection (0.5×–4×, hidden for SVG), format picker, multi-export support, and a live preview with checkerboard background. Also available via context menu "Export…" and <kbd>⇧</kbd><kbd>⌘</kbd><kbd>E</kbd>. SVG export supports rectangles, ellipses, lines, stars, polygons, vectors, text with style runs, gradients, image fills, effects, blend modes, and nested groups.

CLI: `bun open-pencil export --format svg file.fig`. MCP/AI tool: `export_svg`.

## Copy/Paste as

The context menu **Copy/Paste as** submenu exposes multiple clipboard formats:

- **Copy as text** — visible text content from the selection
- **Copy as SVG** — full SVG markup of the selection
- **Copy as PNG** — renders at 2× to the system clipboard (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>C</kbd>)
- **Copy as JSX** — OpenPencil JSX compatible with `renderJsx()`

## Stroke Align & Per-Side Weights

Stroke alignment controls where the stroke is drawn relative to the shape boundary: **Inside** (stroke painted inside, clip path trims overlap with fill), **Center**, or **Outside**. Rendering matches Figma's behavior exactly.

Individual stroke weights per side let you set different widths for Top, Right, Bottom, and Left independently via the side selector dropdown in the Stroke section.

## Context Menu

Right-click on the canvas opens a Figma-style context menu. Actions adapt to the current selection:

- **Clipboard** — Copy, Cut, Paste here, Duplicate, Delete
- **Copy/Paste as** — Copy as text, SVG, PNG (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>C</kbd>), JSX
- **Z-order** — Bring to front, Send to back
- **Grouping** — Group, Ungroup, Add auto layout
- **Components** — Create component, Create component set, Create instance, Go to main component, Detach instance (purple-styled items)
- **Visibility** — Hide/Show, Lock/Unlock
- **Move to page** — submenu with all other pages

Right-clicking a node selects it first. Right-clicking empty canvas clears selection.

## Z-Order, Visibility & Lock

<kbd>]</kbd> brings selected nodes to front, <kbd>[</kbd> sends to back within their parent. <kbd>⇧</kbd><kbd>⌘</kbd><kbd>H</kbd> toggles visibility — hidden nodes stay in the layers panel but don't render. <kbd>⇧</kbd><kbd>⌘</kbd><kbd>L</kbd> toggles lock — locked nodes can't be selected or moved from the canvas. Move nodes between pages via the context menu's "Move to page" submenu.

## Web & Desktop App

OpenPencil runs in the browser at [app.openpencil.dev](https://app.openpencil.dev) — no installation required.

The desktop app uses a Tauri v2 shell (~5MB vs Electron's ~100MB). Works fully offline — no account, no server, no internet required. Native menu bar with File/Edit/View/Object/Window/Help menus on all platforms. macOS gets an app-level submenu. Native Save/Open dialogs via Tauri plugin-dialog. Zstd compression offloaded to Rust for .fig export performance. Developer Tools accessible via <kbd>⌘</kbd><kbd>⌥</kbd><kbd>I</kbd>.

## App Menu (Browser)

In browser mode, a menu bar built with reka-ui Menubar provides access to all major editor actions. Six menus: **File** (Open, Save, Save As, Export selection), **Edit** (Undo, Redo, Copy, Paste, Duplicate, Delete, Select all), **View** (Zoom to fit, Zoom in/out, Toggle rulers), **Object** (Group, Ungroup, Frame selection, Create component, Create component set), **Text** (Font size adjustment, Bold, Italic, Underline, Strikethrough, Align submenu), **Arrange** (Bring to front, Send to back, Bring forward, Send backward). Keyboard shortcuts are displayed next to each menu item with platform-aware modifier labels (⌘ on Mac, Ctrl+ on Windows/Linux). Hidden when running in Tauri, which provides its own native menus.

## Autosave

Files are automatically saved 3 seconds after the last scene change. A debounced watcher monitors `sceneVersion` — multiple rapid edits only trigger a single write after activity settles. Uses the Tauri fs plugin on desktop or the File System Access API in supported browsers. Autosave is disabled for new untitled documents until the user performs an explicit Save As. Errors are handled silently — the user can always trigger a manual save with <kbd>⌘</kbd><kbd>S</kbd>.

**Auto-save toggle** — File → Auto-save disables automatic writes when you want full manual control (useful during exploratory edits you may not want to persist).

## Mobile Layout & PWA

OpenPencil is installable as a Progressive Web App on mobile devices. The responsive layout adapts to small screens:

- Side panels replaced by a **swipeable bottom drawer** with tabs: Layers, Properties, Design, Code
- Toolbar collapses to a compact strip with animated category switching
- Spring-animated drawer with pan gesture control
- PWA manifest with icons and service worker for offline capability (disabled in dev mode)

## Tailwind CSS v4 JSX Export

The Code panel's format toggle switches between two output modes:

- **OpenPencil** — custom component tree (`Frame`, `Text`, `Rect`, etc.) compatible with `renderJsx()`
- **Tailwind CSS v4** — HTML with utility classes (`<div className="flex gap-4 p-3">`) ready to drop into any React or Vue project

Tailwind output supports layout, sizing, colors, border radius, opacity, rotation, overflow, shadows, blur, and typography. Uses v4 spacing semantics (px/4 multiplier) with automatic fallback to arbitrary values for non-standard sizes.

CLI: `bun open-pencil export --format jsx --style tailwind file.fig`

## Google Fonts Fallback

When a font is not available locally, OpenPencil automatically fetches it from Google Fonts API. This ensures text renders correctly when opening .fig files that reference fonts not installed on the system — no manual font installation required.

## Layer Inline Rename

Double-click any layer name in the layers panel to rename it inline. Press **Enter** or click away to commit, **Escape** to cancel. Works for all node types.

## Renderer Profiler

A developer HUD overlay shows per-frame render timing, GPU phase breakdown, and frame budget. Accessible via the View menu. Useful for diagnosing performance issues on complex documents.

## P2P Collaboration

Real-time peer-to-peer collaboration — no server required. Share a link and edit together. Built on Trystero (WebRTC) for direct peer connections and Yjs (CRDT) for conflict-free document sync.

- **Zero hosting cost** — signaling via MQTT public brokers, data flows directly between peers
- **NAT traversal** — Google STUN, Cloudflare STUN, and Open Relay TURN servers
- **Live cursors** — Figma-style colored cursor arrows with white border and name pills, rendered in screen space
- **Presence** — see who's in the room with colored avatars
- **Follow mode** — click a peer's avatar to follow their viewport in real time, click again to stop
- **Local persistence** — y-indexeddb keeps the room alive across page refreshes
- **Secure rooms** — IDs generated with `crypto.getRandomValues()`, shared via `/share/<room-id>` URL

Stale cursors are cleaned up automatically when a peer disconnects.

## Multi-File Tabs

Open multiple documents in tabs within a single window. Tab bar shows open files with close buttons. Middle-click a tab to close it.

- <kbd>⌘</kbd><kbd>N</kbd> or <kbd>⌘</kbd><kbd>T</kbd> — new tab
- <kbd>⌘</kbd><kbd>W</kbd> — close current tab
- <kbd>⌘</kbd><kbd>O</kbd> — open file in new tab
- <kbd>+</kbd> button in tab bar — new tab

Each tab maintains its own document state, undo history, and viewport.

## Effects Rendering

Full rendering of Figma effects via CanvasKit:

- **Drop shadow** — offset, blur radius, spread, color; draws behind opaque content using `MaskFilter` direct draw (no `saveLayer` overhead)
- **Inner shadow** — inset shadow with offset, blur, and color
- **Layer blur** — Gaussian blur on the entire layer
- **Background blur** — blur content behind the layer (glass/frosted effect)
- **Foreground blur** — blur in the foreground

Text shadows render on individual glyphs instead of the bounding box. Each effect has an independent visibility toggle. Per-node `SkPicture` caching means unchanged shadow/blur nodes replay from cache on scene redraws — zero re-computation for static effects.

## Multi-Selection Properties

Select multiple nodes and edit shared properties at once. The properties panel adapts:

- Shared values display normally in all sections (position, size, appearance, fill, stroke, effects)
- Differing values show "Mixed"
- Width and height inputs work across the selection
- Flip horizontal/vertical applies to all selected nodes

Single-node alignment aligns to parent frame bounds. Multi-selection uses the selection bounding box.

## ScrubInput

All numeric inputs in the properties panel use a drag-to-scrub interaction — drag horizontally to adjust the value, or click to type directly. Supports suffix display (°, px, %).

## Homebrew Tap

macOS users can install the desktop app via Homebrew:

```sh
brew install open-pencil/tap/open-pencil
```

Supports Apple Silicon (arm64) and Intel (x64). The tap is auto-updated on each release via GitHub Actions.

## CI/CD Builds

GitHub Actions workflow builds native Tauri desktop apps on version tags. The build matrix covers macOS (arm64, x64), Windows (x64, arm64), and Linux (x64). Builds use `tauri-apps/tauri-action` and produce draft GitHub releases with platform-specific binaries. macOS builds are code-signed and notarized via Apple Developer certificates. Release notes are auto-populated from CHANGELOG.md.

## @open-pencil/core & CLI

The engine is extracted to `packages/core/` (@open-pencil/core) — scene-graph, renderer, layout, codec, kiwi, types — with zero DOM dependencies. The app re-exports from core via thin shims.

`packages/cli/` (@open-pencil/cli) provides headless .fig file operations using CanvasKit CPU rasterization:

- `open-pencil info <file>` — document stats, node types, fonts
- `open-pencil tree <file>` — visual node tree
- `open-pencil find <file>` — search by name/type
- `open-pencil export <file>` — render to PNG/JPG/WEBP at any scale
- `open-pencil analyze colors <file>` — color palette usage with clustering
- `open-pencil analyze typography <file>` — font/size/weight distribution
- `open-pencil analyze spacing <file>` — gap/padding values with grid check
- `open-pencil analyze clusters <file>` — repeated patterns (potential components)
- `open-pencil node <file> <id>` — detailed properties of a node by ID
- `open-pencil pages <file>` — list pages with node counts
- `open-pencil variables <file>` — list design variables and collections
- `open-pencil eval <file>` — execute JavaScript with Figma Plugin API

All commands support `--json` for machine-readable output. Runnable via `bun open-pencil` in the workspace. See [Project Structure](/development/contributing#project-structure) for the full monorepo layout.

The `eval` command deserves special mention: `bun open-pencil eval <file> --code '<js>'` executes JavaScript against a `.fig` file with a Figma-compatible `figma` global object. Enables headless scripting, batch operations, AI tool execution, and testing — all without the GUI. See [Eval Command](/eval-command) for the full reference.

## JSX Renderer

Programmatic design creation via TreeNode builder functions exported from `@open-pencil/core`: Frame, Text, Rectangle, Ellipse, and others. Supports Tailwind-like shorthand props — `w`, `h`, `bg`, `rounded`, `flex`, `gap`, `p`/`px`/`py`, `justify`, `items`, `shadow`, `blur`.

Two rendering paths:
- `renderTreeNode()` — tree → scene graph (any runtime, no external deps)
- `renderJsx()` — JSX string → esbuild → tree → scene graph (CLI/headless)



## AI Chat

Built-in AI assistant accessible via the AI tab in the properties panel or <kbd>⌘</kbd><kbd>J</kbd>. Communicates directly with OpenRouter from the browser — no backend server required. API key stored securely in Tauri Stronghold (localStorage fallback in browser).

**Model selector** with curated models: Claude, Gemini, GPT, DeepSeek, Qwen, Kimi, Llama — stored in `@open-pencil/core` constants with benchmark-ranked tags. Responses stream as markdown (vue-stream-markdown).

**78 tools** defined in `packages/core/src/tools/schema.ts`, covering: read operations (selection, page tree, node details, search, components), create operations (shapes, frames, vectors, slices, pages, components, instances), modify operations (fill, stroke, effects, layout, constraints, text, font, opacity, rotation, radius, visibility, blend mode, lock, stroke align), node manipulation (move, resize, reparent, clone, delete, flatten, boolean operations, arrange), variable CRUD (get, find, create, set, delete, bind, collections), vector path tools (get, set, scale, flip, move), analyze (colors, typography, spacing, clusters), diff (create/show snapshots), and an `eval` escape hatch. Tools are wired to AI chat (valibot schemas), MCP server (zod schemas), and CLI (`eval` command). Tool calls display as collapsible timeline entries in the chat (reka-ui Collapsible).

**MCP server** (`packages/mcp/`) exposes all tools for external AI coding tools. Two transports: stdio for Claude Code/Cursor/Windsurf (`openpencil-mcp`), HTTP with Hono + Streamable HTTP for scripts and CI (`openpencil-mcp-http`). Adds 3 file management tools (`open_file`, `save_file`, `new_document`) on top of the 75 core tools, for 78 total. Runs on Bun and Node.js. See [MCP Tools reference](/reference/mcp-tools).

Tested with Playwright using mock transport for CI (chat), bun:test for tool execution (MCP).

## Code Panel

The Code tab in the properties panel shows the JSX representation of the current selection. Uses `sceneNodeToJsx()` from `@open-pencil/core` to convert the SceneNode subtree into JSX with Tailwind-like shorthand props. Prism.js syntax highlighting with line numbers and a copy-to-clipboard button. Multi-selection shows each node's JSX. The exported JSX is compatible with `renderJsx()` for round-trip creation.



## Code Quality

Copy-paste detection via jscpd — reduced project-wide duplication from 15.6% to 0.62%. Kiwi serialization consolidated into `kiwi-serialize.ts` (shared by clipboard, fig-export, and the CLI). The .fig import pipeline was optimized from O(n²) to O(n) by building a children index upfront — material3.fig (87K nodes) went from 37s to 535ms. ByteBuffer optimized with inline readVarUint and TextDecoder for strings.
