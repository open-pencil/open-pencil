# Figma Feature Matrix

Feature-by-feature comparison of Figma Design capabilities with Open Pencil's current implementation status.

::: tip Status Legend
✅ Supported — feature works end-to-end · 🟡 Partial — core behavior exists, some sub-features missing · 🔲 Not yet implemented
:::

**Coverage:** 94 of 158 Figma feature items addressed — 76 ✅ fully supported, 18 🟡 partial, 64 🔲 not yet. Last updated: 2026-03-07.

## Interface & Navigation

| Feature | Status | Notes |
|---------|--------|-------|
| Toolbar with design tools | ✅ | Bottom toolbar (UI3 style): Select, Frame, Section, Rectangle, Ellipse, Line, Text, Hand, Pen |
| Layers panel (left sidebar) | ✅ | Tree view with expand/collapse, drag reorder, visibility toggle; resizable width |
| Pages panel | ✅ | Add, delete, rename pages; per-page viewport state |
| Properties panel (right sidebar) | ✅ | Sections: Appearance, Fill, Stroke, Effects, Typography, Layout, Position; resizable width |
| Zoom & pan | ✅ | <kbd>Ctrl</kbd> + scroll, pinch, <kbd>⌘</kbd><kbd>+</kbd> / <kbd>⌘</kbd><kbd>−</kbd> / <kbd>⌘</kbd><kbd>0</kbd>, <kbd>Space</kbd> + drag, middle mouse, hand tool (<kbd>H</kbd>) |
| Canvas rulers | ✅ | Top/left rulers with selection highlight bands and coordinate badges |
| Canvas background color | ✅ | Per-page background via properties panel |
| Canvas guides | 🔲 | Figma supports draggable guides from rulers |
| Actions menu / command palette | 🔲 | Figma's quick actions search |
| Context menu | ✅ | Right-click with clipboard, z-order, grouping, component, visibility, lock, move-to-page actions |
| Keyboard shortcuts | 🟡 | Core shortcuts + components + z-order + visibility/lock implemented; Scale, Arrow, Pencil, flip, text formatting not yet wired |
| Find and replace | 🔲 | Text search/replace across document |
| Layer outlines view | 🔲 | Wireframe view of all layers |
| Custom file thumbnails | 🔲 | Thumbnail generated on export, but no custom thumbnail picker |
| Nudge value settings | 🔲 | Default 1px/10px; Figma allows custom small/big nudge values |
| App menu (browser mode) | ✅ | File, Edit, View, Object, Text, Arrange menus; Tauri uses native menus |
| AI tools | 🟡 | 90 tools via OpenRouter + MCP server; no AI-generated images or AI-powered search yet |

## Layers & Shapes

| Feature | Status | Notes |
|---------|--------|-------|
| Shape tools (Rectangle, Ellipse, Line, Polygon, Star) | ✅ | All basic shape types; polygon side count and star inner radius configurable |
| Frames | ✅ | Clip content, independent coordinate system |
| Groups | ✅ | <kbd>⌘</kbd><kbd>G</kbd> to group, <kbd>⇧</kbd><kbd>⌘</kbd><kbd>G</kbd> to ungroup |
| Sections | ✅ | Title pills, auto-adopt overlapping nodes, luminance-adaptive text |
| Arc tool (arcs, semi-circles, rings) | ✅ | arcData with start/end angle and inner radius |
| Pencil (freehand) tool | 🔲 | Figma's freehand drawing tool |
| Masks | 🔲 | Shape masks for clipping layers |
| Layer types & hierarchy | ✅ | 17 node types, flat Map + parent-child tree |
| Select layers | ✅ | Click, shift-click, marquee selection |
| Alignment & position | ✅ | Position, rotation, dimensions in properties panel |
| Copy & paste objects | ✅ | Standard clipboard + Figma Kiwi binary format; Copy as text/SVG/PNG/JSX |
| Scale layers proportionally | 🟡 | Shift-resize constrains proportions; no dedicated Scale tool (K) |
| Lock & unlock layers | ✅ | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>L</kbd> toggles lock; locked nodes can't be selected/moved from canvas |
| Toggle layer visibility | ✅ | Eye icon in layers panel + <kbd>⇧</kbd><kbd>⌘</kbd><kbd>H</kbd> keyboard shortcut |
| Rename layers | ✅ | Double-click inline rename in layers panel; <kbd>Enter</kbd>/<kbd>Escape</kbd>/blur to commit |
| Bring to front / Send to back | ✅ | ] and [ keyboard shortcuts; also in context menu |
| Move to page | ✅ | Move selected nodes between pages via context menu |
| Constraints (responsive resize) | 🔲 | Pin edges/center for parent resize behavior |
| Smart selection (distribute/align) | 🔲 | Evenly space and align multi-selection |
| Layout guides (columns, rows, grid) | 🔲 | Column/row/grid overlay guides on frames |
| Measure distances between layers | 🔲 | Alt-hover to show distances |
| Edit objects in bulk | ✅ | Multi-selection properties panel: edit position, size, appearance, fill, stroke, effects across multiple nodes; shared values display normally, differing values show "Mixed" |
| Identify matching objects | 🔲 | Find similar layers |
| Copy/paste properties | 🔲 | Copy fill/stroke/effects between layers |
| Parent-child relationships | ✅ | Full hierarchy with parentIndex, reparenting via drag |

## Vector Tools

| Feature | Status | Notes |
|---------|--------|-------|
| Vector networks | ✅ | Figma-compatible model, not simple paths |
| Pen tool | ✅ | Corner points, bezier curves, open/closed paths |
| Edit vector layers | 🟡 | Creation works; advanced vertex editing (bend, delete points, join) limited |
| Boolean operations (Union, Subtract, Intersect, Exclude) | 🔲 | Combine shapes with boolean ops |
| Flatten layers | 🔲 | Merge vector paths into single path |
| Convert strokes to paths | 🔲 | Outline Stroke command |
| Convert text to paths | 🔲 | Flatten text to vector outlines |
| Shape builder tool | 🔲 | Interactive boolean tool |
| Offset path | 🔲 | Inset/outset a vector path |
| Simplify path | 🔲 | Reduce vector point count |

## Text & Typography

| Feature | Status | Notes |
|---------|--------|-------|
| Text tool & inline editing | ✅ | Canvas-native editing, phantom textarea, cursor/selection/word select, drag to select, double/triple-click, rich text style runs (<kbd>⌘</kbd><kbd>B</kbd> / <kbd>I</kbd> / <kbd>U</kbd>, **S** button) |
| Text rendering (Paragraph API) | ✅ | CanvasKit Paragraph for shaping, line-breaking, metrics |
| Font loading (system fonts) | ✅ | Inter default, font-kit in Tauri with OnceLock cache + preloading, queryLocalFonts in browser |
| Font family & weight | ✅ | FontPicker with virtual scroll, search, CSS preview; weight selection in properties panel |
| Font size & line height | ✅ | Editable in typography section |
| Text alignment | 🟡 | Basic alignment; Figma has vertical alignment and auto-width/height modes |
| Text styles | 🟡 | Per-selection bold/italic/underline/strikethrough (<kbd>⌘</kbd><kbd>B</kbd> / <kbd>I</kbd> / <kbd>U</kbd>, **S** button); not yet reusable named text style presets |
| Text resizing modes (auto, fixed, hug) | 🔲 | Figma's auto-width, auto-height, fixed-size text modes |
| Bulleted & numbered lists | 🔲 | List formatting in text |
| Links in text | 🔲 | Hyperlinks within text content |
| Emojis & smart symbols | 🔲 | Emoji rendering and special characters |
| OpenType features | 🔲 | Ligatures, stylistic alternates, tabular figures |
| Variable fonts | 🔲 | Adjustable font axes (weight, width, slant) |
| CJK text support | 🔲 | Chinese, Japanese, Korean text rendering |
| RTL text support | 🔲 | Right-to-left text layout |
| Icon fonts | 🔲 | Special handling for icon font glyphs |

## Color, Gradients & Images

| Feature | Status | Notes |
|---------|--------|-------|
| Color picker (HSV) | ✅ | HSV square, hue slider, alpha slider, hex input |
| Solid fills | ✅ | Hex color with opacity |
| Linear gradient | ✅ | Gradient stops, transform handles |
| Radial gradient | ✅ | Rendered via CanvasKit shaders |
| Angular gradient | ✅ | Sweep/conic gradient support |
| Diamond gradient | ✅ | Four-point diamond gradient |
| Image fills | ✅ | Decoded from blob data with scale modes (fill, fit, crop, tile) |
| Pattern fills | 🔲 | Repeating image/pattern fills |
| Blend modes | 🔲 | Layer and fill blend modes (multiply, screen, overlay, etc.) |
| Add images & videos | 🟡 | Image fills rendered; no drag-and-drop image import or video support |
| Image property adjustment | 🔲 | Exposure, contrast, saturation, etc. |
| Crop an image | 🔲 | Interactive image cropping |
| Eyedropper tool | 🔲 | Sample colors from canvas |
| Mixed selection color editing | 🔲 | Adjust colors across heterogeneous selection |
| Color models (RGB, HSL, HSB, Hex) | 🟡 | HSV + Hex in picker; no HSL or RGB mode toggle |

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
| Corner radius | ✅ | Uniform and per-corner radius with independent toggle in properties panel |
| Corner smoothing (iOS-style) | 🔲 | Figma's continuous corner rounding |
| Multiple fills/strokes per layer | 🔲 | Figma allows stacking fills and strokes |

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
| Min/max width and height | 🔲 | Figma supports min/max constraints on auto-layout children |

## Components & Design Systems

| Feature | Status | Notes |
|---------|--------|-------|
| Create components | 🟡 | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> creates from frame/group or wraps selection; no component properties UI yet |
| Component sets | 🟡 | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> combines components; dashed purple border; no variant property editing |
| Component instances | 🟡 | Create instance from context menu with child cloning and componentId mapping; live sync from component; no override editing UI |
| Variants | 🔲 | Variant switching and property-based selection |
| Component properties | 🔲 | Boolean, text, instance swap properties |
| Override propagation | ✅ | Changes to main component propagate to all instances; overrides preserved |
| Variables (color, number, string, boolean) | 🟡 | `COLOR` full UI (dialog, TanStack Table, inline editing, undo/redo, demo collections); `FLOAT`/STRING/BOOLEAN defined but no editing UI |
| Variable collections & modes | 🟡 | Collections, modes, activeMode switching work; no variable-driven theming UI yet |
| Styles (color, text, effect, layout) | 🔲 | Reusable named style presets |
| Libraries (publish, share, update) | 🔲 | Shared component/style libraries |
| Detach instance | ✅ | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd> converts instance back to frame |
| Go to main component | ✅ | Navigate to source component, cross-page |

## Prototyping

| Feature | Status | Notes |
|---------|--------|-------|
| Prototype connections | 🔲 | Planned for Phase 6 |
| Triggers (click, hover, drag, etc.) | 🔲 | Planned for Phase 6 |
| Actions (navigate, overlay, scroll, etc.) | 🔲 | Planned for Phase 6 |
| Animations & transitions | 🔲 | Planned for Phase 6 |
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
| .fig file import | ✅ | Full Kiwi codec: 194 definitions, ~390 fields per `NodeChange` |
| .fig file export | ✅ | Kiwi encoding + Zstd compression + thumbnail generation; `COMPONENT`/COMPONENT_SET mapped to `SYMBOL` for round-trip |
| Save / Save As | ✅ | <kbd>⌘</kbd><kbd>S</kbd> / <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd>; native dialogs (Tauri), File System Access API (Chrome/Edge), download fallback (Safari) |
| Figma clipboard (paste) | ✅ | Decode Kiwi binary from Figma clipboard |
| Figma clipboard (copy) | ✅ | Encode Kiwi binary that Figma can read |
| Sketch file import | 🔲 | .sketch file parsing |
| Image/SVG/PDF export | 🟡 | PNG/JPG/WEBP/SVG export ✅; PDF export 🔲 |
| Version history | 🔲 | Browse and restore previous versions |
| Copy assets between tools | ✅ | Figma clipboard (Kiwi binary), Copy as text/SVG/PNG/JSX |

## Plugin API & Scripting

| Feature | Status | Notes |
|---------|--------|-------|
| Eval command with Figma Plugin API | ✅ | Headless JavaScript execution with figma global object matching Figma's plugin surface |

## Collaboration & Dev Mode

| Feature | Status | Notes |
|---------|--------|-------|
| Comments (pin, thread, resolve) | 🔲 | Planned for Phase 6 |
| Real-time multiplayer | ✅ | P2P via Trystero + Yjs CRDT, cursors, follow mode; no server required |
| Cursor chat | 🔲 | Inline chat bubbles at cursor |
| Branching & merging | 🔲 | Version branches for design files |
| Dev Mode (inspect) | 🟡 | Code tab shows JSX representation of selection; no CSS properties or handoff specs |
| Code Connect | 🔲 | Link design components to code |
| Code snippets | 🟡 | JSX export with syntax highlighting and copy; no CSS/Swift/Kotlin snippets |
| Tailwind CSS v4 export | ✅ | Export as HTML with Tailwind utility classes from Code panel, CLI, or programmatically |
| Figma for VS Code | 🔲 | Editor plugin integration |
| MCP server | ✅ | @open-pencil/mcp with stdio + HTTP transports; 87 core tools + 3 file management tools = 90 total |
| CLI tools | ✅ | Headless CLI: info, tree, find, export, analyze, node, pages, variables, eval; MCP server with stdio + HTTP |

## Figma Draw

| Feature | Status | Notes |
|---------|--------|-------|
| Illustration tools | 🔲 | Figma Draw's specialized drawing tools |
| Pattern transforms | 🔲 | Create repeating patterns with transforms |
