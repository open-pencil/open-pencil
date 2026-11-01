# Figma Feature Matrix

Feature-by-feature comparison of Figma Design capabilities with Open Pencil's current implementation status.

::: tip Status Legend
✅ Supported — feature works end-to-end · 🟡 Partial — core behavior exists, some sub-features missing · 🔲 Not yet implemented
:::

**Coverage:** 128 of 156 Figma feature items addressed — 112 ✅ fully supported, 16 🟡 partial, 28 🔲 not yet. Last updated: 2026-10-27.

## Interface & Navigation

| Feature | Status | Notes |
|---------|--------|-------|
| Toolbar with design tools | ✅ | Bottom toolbar (UI3 style): Move, Frame/Section, shapes, Pen/Pencil, Text, Hand, Comment; customizable, with an icon picker |
| Layers panel (left sidebar) | ✅ | Tree view with expand/collapse, drag reorder, visibility toggle; resizable width |
| Pages panel | ✅ | Add, delete, rename pages; per-page viewport state |
| Properties panel (right sidebar) | ✅ | Appearance, Fill, Stroke, Effects, Typography, Layout, Layout guides, Constraints, Position, Mask, Component properties, Selection colors, Export; resizable width |
| Zoom & pan | ✅ | <kbd>Ctrl</kbd> + scroll, pinch, <kbd>⌘</kbd><kbd>+</kbd> / <kbd>⌘</kbd><kbd>−</kbd> / <kbd>⌘</kbd><kbd>0</kbd> (100%) / <kbd>⌘</kbd><kbd>1</kbd> (fit) / <kbd>⌘</kbd><kbd>2</kbd> (selection), <kbd>Space</kbd> + drag, middle mouse, hand tool (<kbd>H</kbd>) |
| Canvas rulers | ✅ | Top/left rulers with selection highlight bands and coordinate badges |
| Canvas background color | ✅ | Per-page background via properties panel |
| Canvas guides | ✅ | Drag guides from rulers onto the canvas or frames; select, move, duplicate, delete, and undo; saved in `.fig` |
| Actions menu / command palette | ✅ | <kbd>⌘</kbd><kbd>K</kbd> opens a searchable palette of editor and app actions |
| Context menu | ✅ | Right-click with clipboard, z-order, grouping, component, visibility, lock, move-to-page actions |
| Keyboard shortcuts | 🟡 | Tools, editing, booleans, flatten, masks, components, align, z-order, navigation, text formatting; no Scale (<kbd>K</kbd>), Arrow, Eyedropper (<kbd>I</kbd>), or zoom tool |
| Find and replace | 🔲 | Text search/replace across document |
| Layer outlines view | 🔲 | Wireframe view of all layers |
| Custom file thumbnails | 🔲 | Saved files preview their first page, as Figma's do without a Cover page; no thumbnail picker |
| Nudge value settings | 🔲 | Default 1px/10px; Figma allows custom small/big nudge values |
| App menu (browser mode) | ✅ | File, Edit, View, Object, Text, Arrange menus; Tauri uses native menus |
| AI tools | 🟡 | 126 tools in the AI chat, coding agents (ACP), and MCP; stock photos and image vectorization; no AI image generation or AI search |

## Layers & Shapes

| Feature | Status | Notes |
|---------|--------|-------|
| Shape tools (Rectangle, Ellipse, Line, Polygon, Star) | ✅ | All basic shape types; polygon side count and star inner radius configurable |
| Frames | ✅ | Clip content, independent coordinate system, and Figma-style creation and resize presets |
| Groups | ✅ | <kbd>⌘</kbd><kbd>G</kbd> to group, <kbd>⇧</kbd><kbd>⌘</kbd><kbd>G</kbd> to ungroup |
| Sections | ✅ | Title pills, auto-adopt overlapping nodes, luminance-adaptive text |
| Arc tool (arcs, semi-circles, rings) | ✅ | arcData with start/end angle and inner radius |
| Masks | ✅ | Use as Mask (<kbd>⌥</kbd><kbd>⌘</kbd><kbd>M</kbd>); alpha, vector, and luminance mask types in the Mask section |
| Layer types & hierarchy | ✅ | 19 node types, flat Map + parent-child tree |
| Select layers | ✅ | Click, shift-click, marquee selection |
| Alignment & position | ✅ | Position, rotation, dimensions in properties panel |
| Copy & paste objects | ✅ | Standard clipboard + Figma Kiwi binary format; Copy as text/SVG/PNG/JSX |
| Scale layers proportionally | 🟡 | Shift-resize and the aspect ratio lock keep proportions; no Scale tool (<kbd>K</kbd>) that scales strokes, effects, and text |
| Lock & unlock layers | ✅ | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>L</kbd> toggles lock; locked nodes can't be selected/moved from canvas |
| Toggle layer visibility | ✅ | Eye icon in layers panel + <kbd>⇧</kbd><kbd>⌘</kbd><kbd>H</kbd> keyboard shortcut |
| Rename layers | ✅ | Double-click inline rename in layers panel; <kbd>Enter</kbd>/<kbd>Escape</kbd>/blur to commit |
| Bring to front / Send to back | ✅ | ] and [ keyboard shortcuts; also in context menu |
| Move to page | ✅ | Move selected nodes between pages via context menu |
| Constraints (responsive resize) | ✅ | Left, right, center, stretch, and scale on each axis in the Constraints section; applied when the parent resizes, in instances too |
| Smart selection (distribute/align) | 🟡 | Align and distribute from the panel and Arrange menu; no smart selection spacing handles or Tidy up |
| Layout guides (columns, rows, grid) | ✅ | Grids, columns, and rows on frames with count, type, margin, gutter, and color; grid styles; several frames at once |
| Measure distances between layers | ✅ | Hold <kbd>⌥</kbd> and hover to show distances from the selection |
| Edit objects in bulk | ✅ | Multi-selection properties panel: edit position, size, appearance, fill, stroke, effects across multiple nodes; shared values display normally, differing values show "Mixed" |
| Identify matching objects | 🔲 | Find similar layers |
| Copy/paste properties | ✅ | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>C</kbd> / <kbd>⌥</kbd><kbd>⌘</kbd><kbd>V</kbd> through the system clipboard, to and from Figma: fills, strokes, effects, corners, styles, variables, auto layout between frames, text style between text layers |
| Parent-child relationships | ✅ | Full hierarchy with parentIndex, reparenting via drag |

## Vector Tools

| Feature | Status | Notes |
|---------|--------|-------|
| Vector networks | ✅ | Figma-compatible model, not simple paths |
| Pen tool | ✅ | Corner points, bezier curves, open/closed paths |
| Pencil tool | ✅ | Freehand strokes smoothed into curves, <kbd>⇧</kbd> for straight lines |
| Edit vector layers | 🟡 | Select and drag points, handles, segments, and regions; <kbd>⌘</kbd> bends; Delete splits paths; the pen extends them; no per-point mirroring or corner controls |
| Boolean operations (Union, Subtract, Intersect, Exclude) | ✅ | Object menu (<kbd>⌥</kbd><kbd>⇧</kbd><kbd>U</kbd> / <kbd>S</kbd> / <kbd>I</kbd> / <kbd>E</kbd>) and panel control; results stay editable boolean layers |
| Flatten layers | ✅ | Flatten (<kbd>⌥</kbd><kbd>⇧</kbd><kbd>F</kbd>) from the Object and canvas menus |
| Convert strokes to paths | ✅ | Outline stroke replaces each stroked layer with its fill and a stroke vector, keeping rotation, opacity, and effects |
| Convert text to paths | ✅ | Outline text turns text into glyph vectors from the font's outlines |
| Shape builder tool | 🔲 | Interactive boolean tool |
| Offset path | 🔲 | Inset/outset a vector path |
| Simplify path | 🔲 | Reduce vector point count |

## Text & Typography

| Feature | Status | Notes |
|---------|--------|-------|
| Text tool & inline editing | ✅ | Canvas-native editing, phantom textarea, cursor/selection/word select, drag to select, double/triple-click, rich text style runs (<kbd>⌘</kbd><kbd>B</kbd> / <kbd>I</kbd> / <kbd>U</kbd>, **S** button) |
| Text on a path | 🟡 | Imports, renders, selects, resizes, edits, and exports Figma `TEXT_PATH`; character editing requires the referenced font's outlines to be available locally |
| Text rendering (Paragraph API) | ✅ | CanvasKit Paragraph for shaping, line-breaking, metrics |
| Font loading (system fonts) | ✅ | Inter default, font-kit in Tauri with OnceLock cache + preloading, queryLocalFonts in browser |
| Font family & weight | ✅ | FontPicker with virtual scroll, search, CSS preview; weight selection in properties panel |
| Font size & line height | ✅ | Editable in typography section |
| Text alignment | ✅ | Left, center, right, and justified; top, middle, and bottom vertical alignment |
| Text styles | 🟡 | Character-level styling while editing; applies named text styles from `.fig`, libraries, and design tokens; no UI to create or edit a style |
| Text resizing modes (auto, fixed, hug) | ✅ | Auto width, Auto height, and Fixed size in Layout |
| Bulleted & numbered lists | ✅ | Nested bulleted and numbered lists with list and paragraph spacing and hanging markers; <kbd>⇧</kbd><kbd>⌘</kbd><kbd>8</kbd> / <kbd>7</kbd> |
| Links in text | 🟡 | Links on character ranges round-trip through `.fig`, the clipboard, HTML, and the plugin API; no panel control to add one |
| Emojis & smart symbols | ✅ | Color emoji draw with the system emoji font, edit as one character, and survive `.fig` and the clipboard |
| OpenType features | 🟡 | Every feature a file sets renders and round-trips; the panel toggles only ligatures, contextual alternates, and kerning |
| Variable fonts | ✅ | Named styles draw at their axis values and optical size follows the font size, as in Figma; the Typography section and the plugin API set any axis, and optical size can be set by hand |
| CJK text support | ✅ | Language-aware CJK fallback fonts load before first paint, including Traditional Chinese and split web fonts |
| RTL text support | ✅ | Text direction Auto, LTR, or RTL with Arabic shaping; auto layout flows right to left |
| Icon fonts | ✅ | Material Symbols draw from Google's variable fonts at any weight, fill, and grade; the icon picker adds Iconify sets and SF Symbols (macOS 14+) |

## Color, Gradients & Images

| Feature | Status | Notes |
|---------|--------|-------|
| Color picker (HSV) | ✅ | Color area, hue and alpha sliders, hex, and RGB, HSL, HSB, and OkHCL fields |
| Solid fills | ✅ | Hex color with opacity |
| Linear gradient | ✅ | Gradient stops, transform handles |
| Radial gradient | ✅ | Rendered via CanvasKit shaders |
| Angular gradient | ✅ | Sweep/conic gradient support |
| Diamond gradient | ✅ | Four-point diamond gradient |
| Image fills | ✅ | Fill, Fit, Crop, and Tile, with tile scale and 90° rotation |
| Pattern fills | 🟡 | Imported Figma pattern fills render and round-trip; no picker to create or edit them |
| Blend modes | ✅ | Layer, fill, and effect blend modes, with pass-through for groups and frames |
| Add images & videos | 🟡 | Drop or paste PNG, JPEG, GIF, WebP, AVIF, and SVG onto the canvas; no video |
| Image property adjustment | 🔲 | Exposure, contrast, saturation, etc. |
| Crop an image | 🟡 | The Crop mode in the image fill picker keeps a crop; no on-canvas crop handles |
| Eyedropper tool | 🔲 | Sample colors from canvas |
| Mixed selection color editing | ✅ | Selection colors changes a color everywhere across a multi-selection |
| Color models (RGB, HSL, HSB, Hex) | ✅ | Hex, RGB, HSL, HSB, and OkHCL fields with gamut warnings |

## Effects & Properties

| Feature | Status | Notes |
|---------|--------|-------|
| Drop shadow | ✅ | Offset, blur radius, color via CanvasKit filters |
| Inner shadow | ✅ | Inset shadow effect |
| Layer blur | ✅ | Gaussian blur on layer |
| Background blur | ✅ | Blur content behind layer |
| Foreground blur | ✅ | Blur in foreground |
| Stroke weight | ✅ | Configurable in properties panel |
| Stroke cap (round, square, arrow) | ✅ | `NONE`, `ROUND`, `SQUARE`, `ARROW_LINES`, `ARROW_EQUILATERAL` |
| Stroke join (miter, bevel, round) | ✅ | All three join types |
| Dash patterns | ✅ | Dash-on/dash-off stroke pattern |
| Stroke alignment | ✅ | Inside/Center/Outside with clip-based rendering matching Figma behavior |
| Individual stroke weights per side | ✅ | Top/Right/Bottom/Left with side selector dropdown |
| Corner radius | ✅ | Uniform and per-corner radius with independent toggle in properties panel; canvas handles on rectangles, polygons, and stars |
| Corner smoothing (iOS-style) | ✅ | Corner smoothing slider in Appearance; smoothed corners render, dash, and round-trip as Figma's |
| Multiple fills/strokes per layer | ✅ | Add, remove, hide, and blend any number of fills and strokes; strokes take gradients and images |

## Auto Layout

| Feature | Status | Notes |
|---------|--------|-------|
| Horizontal & vertical flow | ✅ | Yoga WASM flexbox engine |
| Toggle auto layout (<kbd>⇧</kbd><kbd>A</kbd>) | ✅ | Toggle on frame or wrap selection |
| Gap (spacing between children) | ✅ | Configurable in properties panel |
| Padding (uniform & per-side) | ✅ | All four sides independently |
| Justify content | ✅ | Start, center, end, space-between |
| Align items | ✅ | Start, center, end, stretch |
| Child sizing (fixed, fill, hug) | ✅ | Per-child sizing modes |
| Wrap | ✅ | Flex wrap for multi-line layout |
| Grid auto layout flow | ✅ | CSS Grid via Yoga fork — column/row tracks, gaps, spans |
| Combined flows (nested) | ✅ | Nested auto-layout frames with different directions |
| Drag reorder within auto layout | ✅ | Visual insertion indicator |
| Min/max width and height | ✅ | Min and max width and height in Layout, bindable to number variables |

## Components & Design Systems

| Feature | Status | Notes |
|---------|--------|-------|
| Create components | ✅ | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> creates from frame/group or wraps selection; component properties UI supports text, visibility, instance swap, and variants |
| Component sets | ✅ | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> combines components; multidimensional sparse variant authoring with duplicate validation and top-left default |
| Component instances | ✅ | Assets browsing, insertion, editable component properties and overrides, variant switching, live sync, and update review |
| Variants | ✅ | Multidimensional sparse combinations, authoring, instance switching, duplicate validation, and top-left fallback |
| Component properties | ✅ | Boolean, text, instance-swap, and slot properties; expose nested instances and reorder from the panel |
| Override propagation | ✅ | Changes to main component propagate to all instances; overrides preserved |
| Variables (color, number, string, boolean) | ✅ | All four types in the variables dialog with aliases, formulas, and per-mode values; bound to paints, sizing, spacing, typography, visibility, and text |
| Variable collections & modes | ✅ | Collections with modes; apply a mode, or Auto, to layers and pages from Appearance |
| Styles (color, text, effect, layout) | 🟡 | Apply and detach fill, stroke, text, effect, and grid styles from `.fig`, libraries, and design tokens; no UI to create or edit styles |
| Libraries (publish, share, update) | ✅ | Immutable local/storage revisions, selective publication, enablement, scoped update review, offline materialization, and `.fig` persistence |
| Detach instance | ✅ | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd> converts instance back to frame |
| Go to main component | ✅ | Navigate to source component, cross-page |

## Prototyping

| Feature | Status | Notes |
|---------|--------|-------|
| Prototype connections | 🔲 | Not supported yet |
| Triggers (click, hover, drag, etc.) | 🔲 | Not supported yet |
| Actions (navigate, overlay, scroll, etc.) | 🔲 | Not supported yet |
| Animations & transitions | 🔲 | Not supported yet |
| Smart animate | 🔲 | Auto-animate matching layers |
| Overlays | 🔲 | Modal/popover prototyping |
| Scroll & overflow behavior | 🔲 | Scrollable frames in prototypes |
| Prototype flows | 🔲 | Named starting points |
| Variables in prototypes | 🔲 | Conditional logic with variables |
| Easing & spring animations | 🔲 | Custom animation curves |
| Present & play prototypes | 🔲 | Fullscreen prototype viewer |

## Import & Export

| Feature | Status | Notes |
|---------|--------|-------|
| .fig file import | ✅ | Full Kiwi codec: 605 schema definitions, ~590 fields per `NodeChange` |
| .fig file export | ✅ | Kiwi encoding + Zstd compression + thumbnail generation; `COMPONENT`/COMPONENT_SET mapped to `SYMBOL` for round-trip |
| Save / Save As | ✅ | <kbd>⌘</kbd><kbd>S</kbd> / <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd>; native dialogs (Tauri), File System Access API (Chrome/Edge), download fallback (Safari) |
| Figma clipboard (paste) | ✅ | Decode Kiwi binary from Figma clipboard |
| Figma clipboard (copy) | ✅ | Encode Kiwi binary that Figma can read |
| Sketch file import | 🔲 | .sketch file parsing |
| Image/SVG/PDF export | ✅ | PNG, JPG, WEBP, SVG, PDF with embedded fonts where their files can be embedded, PPTX, and draw.io |
| Version history | 🟡 | OpenPencil Cloud documents (in preview): save named versions, browse, preview, restore, and duplicate; not for local files |
| Copy assets between tools | ✅ | Figma clipboard (Kiwi binary), Copy as text/SVG/PNG/JSX |

## Plugin API & Scripting

| Feature | Status | Notes |
|---------|--------|-------|
| Eval command with Figma Plugin API | ✅ | Headless JavaScript execution with figma global object matching Figma's plugin surface |

## Collaboration & Dev Mode

| Feature | Status | Notes |
|---------|--------|-------|
| Comments (pin, thread, resolve) | ✅ | Comment tool (<kbd>C</kbd>) pins threads to layers with replies, resolving, and a filterable list; saved in `.fig` |
| Real-time multiplayer | ✅ | Peer-to-peer rooms (Trystero + Yjs) with cursors, follow mode, voice calls, and agent cursors; no server required |
| Cursor chat | 🔲 | Inline chat bubbles at cursor |
| Branching & merging | 🔲 | Version branches for design files |
| Dev Mode (inspect) | 🟡 | Code tab shows the selection as design JSX, HTML, Vue, or React with CSS or Tailwind; Ready for dev statuses; no redline inspect mode |
| Code Connect | 🔲 | Link design components to code |
| Code snippets | 🟡 | Design JSX, HTML, Vue, and React with CSS or Tailwind and token-aware values; no Swift, Kotlin, or Compose |
| Tailwind CSS v4 export | ✅ | Export as HTML with Tailwind utility classes from Code panel, CLI, or programmatically |
| Figma for VS Code | 🔲 | Editor plugin integration |
| MCP server | ✅ | `@open-pencil/mcp` with stdio + HTTP transports; 125 core tools plus document, history, and settings tools |
| CLI tools | ✅ | 24 commands, including info, tree, find, query, node, pages, variables, tokens, fonts, lint, analyze, export, import, convert, diff, eval, and tool |

## Figma Draw

| Feature | Status | Notes |
|---------|--------|-------|
| Illustration tools | 🔲 | Figma Draw's specialized drawing tools |
| Pattern transforms | 🔲 | Create repeating patterns with transforms |
