# OpenPencil

Open-source, AI-native design editor. Think Figma, but you can self-host it, extend it, and talk to it.

## Why

- Figma is proprietary, expensive, and actively fights programmatic access
- Penpot is SVG-based (slow for complex documents)
- No existing tool combines open source + Skia rendering + AI-native design + .fig compatibility

## Positioning

| | OpenPencil | Figma | Penpot |
|---|---|---|---|
| Open source | ✅ MIT | ❌ | ✅ |
| Rendering | Skia (WASM) | Skia (WASM) | SVG |
| AI-native | ✅ 38 tools | ❌ Plugins only | ❌ |
| .fig import/export | ✅ | N/A | ❌ |
| Desktop | Tauri (~7 MB) | Electron | Browser |
| Collaboration | P2P (WebRTC + CRDT) | Proprietary | WebSocket |
| Self-hosted | ✅ | ❌ | ✅ |
| Cost | Free forever | $15/editor/mo | Free (self-host) |

## Reusable assets from figma-use

We've built a substantial toolkit in figma-use that transfers directly:

### Figma binary format (Kiwi)
- Full Kiwi encoder/decoder for .fig files
- 533-definition schema (NodeChange with 538 fields)
- Zstd compression/decompression
- Direct WebSocket multiplayer protocol (3000-6000x faster than plugin API)
- Variable binding encoding
- All node types, fills, strokes, effects, transforms

### JSX renderer
- `packages/render` — declarative JSX-to-design-nodes renderer
- Frame, Text, Rect, Ellipse, Line, Star, Polygon, Vector, Icon primitives
- Layout props (flex, gap, padding, justify, items)
- Variable references in colors (`var:Name`, `$Name`)

### Design linter (17 rules)
- `packages/linter` — standalone, reusable as-is
- Design tokens, layout, typography, accessibility, structure rules
- Presets: recommended, strict, accessibility, design-system

### MCP server
- `packages/mcp` — full MCP implementation for AI agents
- All design operations as MCP tools
- Battle-tested with Claude, works with any MCP client

### XPath query engine
- `packages/plugin/src/query.ts` — query nodes by type, attributes, structure
- `//FRAME[@width > 100]`, `//TEXT[contains(@name, 'Button')]`

### Export pipeline
- JSX export with icon matching (Iconify)
- Storybook generation (React/Vue)
- Font extraction (Google Fonts CSS)
- Screenshot/PNG/SVG/PDF export

### Analyze tools
- Cluster detection (repeated patterns → potential components)
- Color palette analysis with similarity merging
- Typography audit (font combinations, sizes, weights)
- Spacing analysis (grid compliance check)
- Accessibility tree snapshot

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Tauri Shell                              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                     Editor (Web)                           │  │
│  │                                                            │  │
│  │  ┌─────────────────┐  ┌─────────────────────────────────┐ │  │
│  │  │   Vue 3 UI      │  │    Skia CanvasKit (WASM, 7MB)   │ │  │
│  │  │                 │  │    - Vector rendering            │ │  │
│  │  │  - Toolbar      │  │    - Text shaping               │ │  │
│  │  │  - Panels       │  │    - Image processing           │ │  │
│  │  │  - Properties   │  │    - Effects (blur, shadow)     │ │  │
│  │  │  - Layers       │  │    - Export (PNG, SVG, PDF)     │ │  │
│  │  │  - Variables    │  │                                  │ │  │
│  │  │  - AI Chat      │  └─────────────────────────────────┘ │  │
│  │  └─────────────────┘                                      │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │                  Core Engine (TS)                     │ │  │
│  │  │                                                      │ │  │
│  │  │  SceneGraph ─── Layout (Yoga) ─── Selection          │ │  │
│  │  │      │                                  │             │ │  │
│  │  │  Undo/Redo ─── Constraints ─── Hit Testing           │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │              File Format Layer                        │ │  │
│  │  │                                                      │ │  │
│  │  │  .openpencil (Kiwi binary, same codec as .fig)       │ │  │
│  │  │  .fig import ── .pen import ── .svg/.png export      │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                  AI Tools (26 ToolDefs)                    │  │
│  │                                                            │  │
│  │  create_shape ── set_fill ── render (JSX) ── get_node     │  │
│  │  set_layout ── find_nodes ── eval_code ── ...             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Collaboration (P2P, no server)               │  │
│  │                                                            │  │
│  │  Trystero (WebRTC) ── Yjs (CRDT) ── y-indexeddb          │  │
│  │  Cursors ── Presence ── Follow mode                       │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Tools (complete list)

Everything a designer needs, organized by what you're doing.

### Editor layout

Follows Figma's UI3 layout (introduced Config 2024) — toolbar at the bottom, navigation on the left, properties on the right. This is the modern standard designers expect.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Navigation panel (left)  │              Canvas                │ Properties panel (right) │
│                          │                                    │                          │
│ ┌──────────────────────┐ │                                    │ ┌──────────────────────┐ │
│ │ 📄 File name      ▾  │ │                                    │ │ Appearance           │ │
│ ├──────────────────────┤ │                                    │ │ ┌──────────────────┐ │ │
│ │ Layers │ Assets │ Pages│ │         ┌─────────────────┐       │ │ │ W: 400  H: 300   │ │ │
│ ├──────────────────────┤ │         │                 │       │ │ │ X: 100  Y: 200   │ │ │
│ │ ▾ 🔲 Header          │ │         │  Selected Frame │       │ │ │ R: 0°             │ │ │
│ │   ├── T  Logo        │ │         │                 │       │ │ └──────────────────┘ │ │
│ │   ├── 🔲 Nav         │ │         └─────────────────┘       │ ├──────────────────────┤ │
│ │   │   ├── T  Home    │ │                                    │ │ Layout               │ │
│ │   │   └── T  About   │ │     ┌──────────┐                  │ │ Auto layout  →  ↓  ↩ │ │
│ │   └── ◆ CTA Button   │ │     │  Card     │                  │ │ Gap: 16  Pad: 20     │ │
│ │ ▾ 🔲 Hero            │ │     │           │                  │ ├──────────────────────┤ │
│ │   ├── T  Heading      │ │     └──────────┘                  │ │ Position             │ │
│ │   └── ○ Avatar        │ │                                    │ │ Constraints: ◫       │ │
│ │ ▸ 🔲 Footer           │ │                                    │ ├──────────────────────┤ │
│ │                        │ │                                    │ │ Fill                 │ │
│ │                        │ │                                    │ │ ■ #3B82F6    100%  + │ │
│ │                        │ │                                    │ ├──────────────────────┤ │
│ │                        │ │                                    │ │ Stroke               │ │
│ │                        │ │                                    │ │ (none)             + │ │
│ │                        │ │                                    │ ├──────────────────────┤ │
│ │                        │ │                                    │ │ Effects              │ │
│ │                        │ │                                    │ │ (none)             + │ │
│ │                        │ │                                    │ ├──────────────────────┤ │
│ │                        │ │                                    │ │ Export               │ │
│ │                        │ │                                    │ │ (none)             + │ │
│ └──────────────────────┘ │                                    │ └──────────────────────┘ │
│                          │                                    │                          │
├──────────────────────────┴────────────────────────────────────┴──────────────────────────┤
│                                    Toolbar (bottom)                                      │
│  ▶ Select │ # Frame ▾ │ □ Shape ▾ │ ✎ Pen ▾ │ T Text │ 🤚 Hand │ 💬 Comment │ ⚡Actions │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Three panels:**
- **Navigation panel (left)** — tabs for Layers, Assets (component library), Pages. File name + actions dropdown at top. Resizable, collapsible.
- **Canvas (center)** — infinite canvas with zoom/pan. All design work happens here.
- **Properties panel (right)** — context-sensitive. Sections: Appearance (size, position, rotation), Layout (auto-layout / grid), Position (constraints), Fill, Stroke, Effects, Export. Resizable.
- **Toolbar (bottom)** — design tools in a horizontal strip. Frees up vertical space on canvas. Includes the Actions menu (AI, plugins, productivity shortcuts).

**Why bottom toolbar (Figma UI3 style):**
- More vertical canvas space (design is primarily vertical — phone screens, web pages)
- Tools are closer to where your cursor naturally rests
- Actions menu at the end provides AI/plugin access without cluttering the toolbar
- Consistent with what Figma designers already know (as of April 2025, UI3 is the only Figma UI)

### Toolbar (bottom bar)

Horizontal strip at the bottom of the canvas. Tools grouped with subtle dividers. Some tools have a ▾ dropdown for nested tools.

```
┌─────┬─────────┬──────────┬────────┬───────┬───────┬─────────┬──────────┐
│  ▶  │  # ▾    │  □ ▾     │  ✎ ▾   │  T    │  🤚   │  💬     │ ⚡Actions │
│Select│ Frame   │ Shapes   │ Draw   │ Text  │ Hand  │ Comment │          │
│  V   │ Section │ Rect   R │ Pen  P │   T   │   H   │   C     │          │
│  K   │ Slice   │ Ellipse O│Pencil  │       │       │         │          │
│      │         │ Line   L │        │       │       │         │          │
│      │         │ Arrow    │        │       │       │         │          │
│      │         │ Polygon  │        │       │       │         │          │
│      │         │ Star     │        │       │       │         │          │
└─────┴─────────┴──────────┴────────┴───────┴───────┴─────────┴──────────┘
```

**Actions menu (⚡)** — the AI entry point:
- 🤖 AI Chat — open sidebar for conversational design with AI
- Quick actions: create component, auto-layout, tidy up, etc.
- Plugins
- Run MCP tool manually

### Tool options bar

A horizontal bar above the canvas changes based on the active tool. Shows contextual controls the designer needs right now.

| Active tool | Options bar contents |
|---|---|
| **Select** (nothing selected) | *empty* |
| **Select** (node selected) | X, Y, W, H inputs · Rotation · Corner radius · Constraints dropdown |
| **Select** (multiple selected) | Align buttons (6) · Distribute H/V · Tidy up · Boolean ops dropdown |
| **Frame** | Preset sizes dropdown (iPhone 16, Desktop 1440, Custom…) · Fill color · Layout mode toggle |
| **Rectangle** | W, H inputs · Fill color · Corner radius · Stroke toggle |
| **Ellipse** | W, H inputs · Fill color · Arc start/end/ratio |
| **Line** | Length · Stroke color · Stroke weight · Cap style (butt/round/square) · Arrow toggles |
| **Polygon** | Sides (3-12 slider) · Radius · Fill color |
| **Star** | Points (3-20) · Inner radius ratio (0-1) · Fill color |
| **Pen** | Path close toggle · Fill/Stroke toggles · Bend tool |
| **Pencil** | Stroke weight · Smoothing (0-100) · Stroke color |
| **Text** | Font family · Weight · Size · Line height · Letter spacing · Align (L/C/R/J) · Color |
| **Hand** | Zoom level indicator |
| **Comment** | *empty* (click canvas to place) |

### Canvas navigation

| Action | Input | Behavior |
|--------|-------|----------|
| Pan | Space+drag / Middle mouse drag / Two-finger trackpad | Move viewport |
| Zoom in | Cmd+= / Scroll up / Pinch out | Zoom toward cursor position |
| Zoom out | Cmd+- / Scroll down / Pinch in | Zoom toward cursor position |
| Zoom to fit all | Shift+1 | Fit all content in view with padding |
| Zoom to selection | Shift+2 | Fit selected nodes in view |
| Zoom to 100% | Cmd+0 | Reset to actual pixels |
| Zoom to 50%/200% | Cmd+1 / Cmd+2 | Preset zoom levels |
| Pixel preview | — | Render at 1x showing actual pixels |
| Rulers | Shift+R | Toggle rulers on canvas edges |
| Grid | Cmd+' | Toggle layout grid overlay |
| Guides | Drag from ruler | Create horizontal/vertical guide line |
| Minimap | — | Small overview in bottom-right corner (toggle) |

### Selection & manipulation

| Action | Input | Behavior |
|--------|-------|----------|
| Select | Click | Select topmost node under cursor |
| Deep select | Double-click | Enter group/frame, select child |
| Multi-select | Shift+click | Toggle node in selection |
| Marquee select | Drag on empty canvas | Select all nodes intersecting rectangle |
| Move | Drag selected | Move by delta. Shift constrains to axis. Smart guides snap to edges/centers of siblings |
| Resize | Drag handle | 8 handles around selection. Shift constrains proportions. Alt resizes from center |
| Rotate | Hover just outside corner handle → rotate cursor → drag | Rotation. Shift snaps to 15° increments |
| Scale | K then drag | Scale tool, resizes content including text size and stroke weight |
| Nudge | Arrow keys | Move 1px. Shift+arrow moves 10px |
| Duplicate | Alt+drag / Cmd+D | Duplicate in place or at drag position |
| Copy/Paste | Cmd+C / Cmd+V | Clipboard. Paste positions at cursor or center of viewport |
| Copy as CSS | Cmd+Shift+C | Copy selected node's styles as CSS to clipboard |
| Delete | Backspace / Delete | Remove selected nodes |

### Smart guides & snapping

| Feature | Behavior |
|---------|----------|
| Edge snapping | Red lines appear when edges align with siblings (±1px threshold) |
| Center snapping | Vertical/horizontal center lines shown |
| Spacing guides | Pink dimension labels when equal spacing detected between 3+ objects |
| Parent padding | Snap to parent's padding boundaries |
| Grid snapping | Snap to pixel grid (configurable: 1px, 8px, custom) |
| Distance labels | Shows distance (px) between selected node and hovered node |

### Shapes

| Tool | Shortcut | Draw behavior | Modifier keys |
|------|----------|---------------|---------------|
| Frame | F | Click+drag to create sized frame. Click to create default (100×100) | Shift: square. Alt: from center |
| Section | Shift+S | Click+drag to create section region | — |
| Rectangle | R | Click+drag | Shift: square. Alt: from center. Both: square from center |
| Ellipse | O | Click+drag | Shift: circle. Alt: from center |
| Line | L | Click+drag | Shift: constrain to 0°/45°/90° |
| Arrow | Shift+L | Click+drag, auto-adds arrow endpoint | Shift: constrain angle |
| Polygon | — | Click+drag for size, then adjust sides in options bar | Shift: constrain proportions |
| Star | — | Click+drag for outer radius, options bar for points/inner ratio | Shift: constrain proportions |

### Pen & Pencil

| Action | Input | Behavior |
|--------|-------|----------|
| Place point | Click | Straight corner point |
| Place curve point | Click+drag | Bezier curve, drag sets handle length/angle |
| Close path | Click first point | Closes the path |
| Cancel | Escape | Finish open path |
| Continue path | Select endpoint + P | Resume drawing from an existing path end |
| Edit point | Double-click node with Select tool | Enter vector edit mode |
| Move point | Drag point | Move anchor point |
| Adjust handle | Drag handle | Change curve shape. Alt+drag breaks handle symmetry |
| Add point | Click on segment | Insert new anchor point on path |
| Delete point | Select point + Delete | Remove point, path reconnects |
| Toggle straight/curve | Double-click point | Convert between corner and smooth point |
| Bend | Click segment + drag | Convert straight segment to curve |
| Pencil freehand | Shift+P then drag | Freehand stroke, auto-simplified to bezier path |

### Text

| Action | Input | Behavior |
|--------|-------|----------|
| Create text box | T then click | Auto-width text, grows horizontally |
| Create fixed-width text | T then click+drag | Fixed width, wraps and grows vertically |
| Edit text | Double-click text node | Enter text editing mode |
| Select word | Double-click word | Select word |
| Select paragraph | Triple-click | Select paragraph |
| Select all | Cmd+A (in text edit mode) | Select all text in this text node |
| Bold range | Select text + Cmd+B | Toggle bold on selection |
| Italic range | Select text + Cmd+I | Toggle italic on selection |
| Underline | Select text + Cmd+U | Toggle underline |
| Strikethrough | Select text + Cmd+Shift+X | Toggle strikethrough |
| Change font/size | Select text + use options bar | Mixed styles within one text box |
| Bulleted list | Select + options bar | Toggle unordered list |
| Numbered list | Select + options bar | Toggle ordered list |
| Link | Select text + Cmd+K | Add hyperlink |
| Exit text edit | Escape / Click outside | Return to Select tool |

**Text auto-resize modes:**
- **None** — fixed width and height, clips overflow
- **Height** — fixed width, grows vertically to fit content
- **Width and height** — grows both directions to fit content
- **Truncate** — fixed size, shows ellipsis (…) on overflow

### Properties panel (right side)

Context-sensitive. Sections are grouped to match Figma UI3's modern layout. Sections collapse/expand. The panel is resizable.

**Header row** — shows selection name, component status, and quick actions (mask, create component, boolean ops, more ⋯ menu).

**Appearance section:**
- W, H inputs (width, height)
- Rotation input (degrees)
- Corner radius: uniform input, click 🔓 for independent corners (TL, TR, BR, BL)
- Corner smoothing slider (0-100%, squircle)
- Opacity slider 0-100%
- Blend mode dropdown (18 modes)
- Clip content checkbox

**Layout section:**
- Shows "Use auto layout" button when no layout set
- When auto-layout active: direction, gap, padding, justify, align, child sizing (see Layout panel details below)
- When grid active: template columns/rows, gaps (see Grid layout details below)

**Position section:**
- X, Y inputs (absolute position on canvas)
- Constraints visual picker (box with pin toggles for each edge + center)
- Horizontal: left / right / left+right / center / scale
- Vertical: top / bottom / top+bottom / center / scale
- "Ignore auto layout" toggle (absolute position within auto-layout parent)

**Fill section:**
- Add/remove fills (multiple fills supported, stacked with blend modes)
- Types: solid, linear gradient, radial gradient, angular gradient, diamond gradient, image
- Color picker: HSB/RGB/Hex input, opacity slider, eyedropper tool (I)
- Gradient editor: add/remove stops, drag stop positions, edit stop colors
- Image fill: tile/fill/fit/crop modes, exposure/contrast/saturation filters
- Variable binding: click 🔗 icon → pick variable from collection

**Stroke section:**
- Add/remove strokes (multiple supported)
- Color (same as fill)
- Weight: number input (supports independent per-side: top/right/bottom/left)
- Alignment: inside / center / outside
- Dashes: gap and dash length inputs (or preset patterns)
- Cap: butt / round / square
- Join: miter / bevel / round
- Variable binding for color

**Effects section:**
- Add/remove effects (stackable)
- Drop shadow: color, X offset, Y offset, blur, spread, show behind node toggle
- Inner shadow: color, X offset, Y offset, blur, spread
- Layer blur: radius
- Background blur: radius

**Export section:**
- Add export presets: format (PNG/SVG/PDF/JPG) + scale (0.5x-4x) + suffix
- Multiple presets per node
- Export selected: Cmd+Shift+E

### Layout panel (auto-layout frames)

Appears in properties panel when a frame with layout is selected.

```
┌─────────────────────────────────────┐
│ Auto Layout                    [X]  │  ← click X to remove layout
├─────────────────────────────────────┤
│ Direction: [→] [↓] [↩]             │  ← horizontal / vertical / wrap
│ Gap: [16]  Padding: [20]  [🔓]     │  ← unlock for per-side padding
│                                     │
│ Justify: [≡] start/center/end/between/around/evenly
│ Align:   [≡] start/center/end/stretch/baseline
│                                     │
│ ─── Children sizing ───             │
│ Primary: Fixed / Fill / Hug         │
│ Counter: Fixed / Fill / Hug         │
│ Min W: [__] Max W: [__]            │
│ Min H: [__] Max H: [__]            │
└─────────────────────────────────────┘
```

**CSS Grid mode** (when Yoga supports it):
```
┌─────────────────────────────────────┐
│ Grid Layout                    [X]  │
├─────────────────────────────────────┤
│ Columns: [1fr] [1fr] [1fr]    [+]  │  ← add/remove/edit tracks
│ Rows:    [auto] [auto]        [+]  │
│ Col gap: [16]  Row gap: [12]        │
└─────────────────────────────────────┘
```

### Layers panel

Left side panel. Tree view of the document.

```
┌──────────────────────────────────────┐
│ 📄 Page 1  ▾                        │  ← page selector dropdown
├──────────────────────────────────────┤
│ ▾ 🔲 Header                    👁 🔒│
│   ├── T  Logo text              👁  │
│   ├── 🔲 Nav                    👁  │
│   │   ├── T  Home               👁  │
│   │   ├── T  About              👁  │
│   │   └── T  Contact            👁  │
│   └── ◆ CTA Button (instance)  👁  │
│ ▾ 🔲 Hero Section              👁  │
│   ├── T  Heading                👁  │
│   ├── T  Subheading             👁  │
│   └── ○ Avatar                  👁  │
│ ▸ 🔲 Footer (collapsed)        👁  │
└──────────────────────────────────────┘
```

| Action | Input | Behavior |
|--------|-------|----------|
| Select layer | Click | Select corresponding node on canvas |
| Multi-select | Cmd+click | Add/remove from selection |
| Range select | Shift+click | Select range between last selected and clicked |
| Expand/collapse | Click ▸/▾ | Toggle children visibility |
| Rename | Double-click name | Inline rename |
| Reorder | Drag layer | Move in tree (changes z-order and parent) |
| Toggle visibility | Click 👁 | Show/hide node |
| Toggle lock | Click 🔒 | Lock/unlock node |
| Drag into frame | Drag layer onto another layer | Reparent node |
| Search | Cmd+F in panel | Filter layers by name |

### Components

| Action | How |
|--------|-----|
| Create component | Select frame → Right-click → "Create component" or Cmd+Alt+K |
| Create instance | Drag component from assets panel or Alt+drag existing instance |
| Detach instance | Right-click instance → "Detach instance" |
| Reset overrides | Right-click instance → "Reset all overrides" |
| Edit main component | Double-click instance → "Go to main component" |
| Create variant | Select component → "+" button in properties → set variant property values |
| Swap variant | Select instance → variant dropdown in properties panel |
| Add component prop | Select main component → properties panel → "+" next to properties section |
| Component prop types | Text (overridable string), Boolean (show/hide layer), Instance swap (replace nested instance), Variant (select variant) |

### Variables panel

Separate panel (tab alongside properties), or modal.

```
┌──────────────────────────────────────┐
│ Variables                            │
├──────────────────────────────────────┤
│ 📁 Colors                      [+]  │  ← collection
│   Modes: [Light] [Dark]        [+]  │
│   ─────────────────────────────────  │
│   Primary     🟦 #3B82F6  🟦 #60A5FA│
│   Secondary   🟪 #8B5CF6  🟪 #A78BFA│
│   Background  ⬜ #FFFFFF  ⬛ #0F172A│
│   Text        ⬛ #1E293B  ⬜ #F8FAFC│
│                                      │
│ 📁 Spacing                     [+]  │
│   SM   4                             │
│   MD   8                             │
│   LG   16                            │
│   XL   32                            │
│                                      │
│ 📁 Typography                  [+]  │
│   Body Size     16                   │
│   Heading Size  32                   │
└──────────────────────────────────────┘
```

| Action | How |
|--------|-----|
| Create collection | "+" button at top → name collection → add modes |
| Create variable | "+" inside collection → type (color/number/string/boolean) → name → values per mode |
| Bind to node | Select node → click 🔗 in fill/stroke/text/etc. → pick variable |
| Edit variable | Click value cell → edit inline |
| Switch mode | Top-right mode switcher in canvas → all bound properties update live |
| Alias variable | Set variable value to reference another variable |

### Boolean Operations

| Operation | Shortcut | Description |
|-----------|----------|-------------|
| Union | Cmd+Shift+U | Combine shapes |
| Subtract | Cmd+Shift+S | Cut one shape from another |
| Intersect | Cmd+Shift+I | Keep overlapping area |
| Exclude | Cmd+Shift+E | Keep non-overlapping areas |
| Flatten | Cmd+E | Merge into single vector |

### Alignment & distribution

Available when 2+ nodes selected. Shown in options bar and right-click menu.

| Action | Shortcut | Description |
|--------|----------|-------------|
| Align left | Alt+A | Align left edges |
| Align horizontal center | Alt+H | Align horizontal centers |
| Align right | Alt+D | Align right edges |
| Align top | Alt+W | Align top edges |
| Align vertical center | Alt+V | Align vertical centers |
| Align bottom | Alt+S | Align bottom edges |
| Distribute horizontally | Ctrl+Alt+H | Equal horizontal spacing |
| Distribute vertically | Ctrl+Alt+V | Equal vertical spacing |
| Tidy up | Ctrl+Alt+T | Auto-arrange into grid with equal spacing |
| Match width | — | Set all selected to same width |
| Match height | — | Set all selected to same height |

### Pages

| Action | How |
|--------|-----|
| Switch page | Click page name in layers panel dropdown |
| Create page | "+" next to page dropdown |
| Rename page | Double-click page name |
| Delete page | Right-click → Delete (cannot delete last page) |
| Reorder pages | Drag in dropdown list |
| Duplicate page | Right-click → Duplicate |

### Import & Export

| Format | Import | Export |
|--------|--------|--------|
| .fig (Figma) | ✅ Kiwi binary codec | ✅ Kiwi + Zstd + thumbnail |
| .png | ✅ (image fill) | ✅ (1x, 2x, 3x) via CLI and editor |
| .jpg | ✅ (image fill) | ✅ |
| .webp | — | ✅ |
| .svg | planned | planned |
| .pdf | — | planned |
| Figma clipboard | ✅ copy/paste between apps | ✅ |

### AI tools — 38 tools

Tools are defined once in `packages/core/src/tools/schema.ts` as framework-agnostic `ToolDef` objects. Available in the in-app AI chat (via Vercel AI SDK adapter) and in the CLI via the `eval` command.

#### Read (7 tools)

| Tool | Description |
|------|-------------|
| `get_selection` | Get selected nodes |
| `get_page_tree` | Get page node tree |
| `get_node` | Get node by ID |
| `find_nodes` | Find nodes by name or type |
| `list_pages` | List all pages |
| `list_variables` | List design variables |
| `list_collections` | List variable collections |

#### Create (4 tools)

| Tool | Description |
|------|-------------|
| `create_shape` | Create a shape (frame, rect, ellipse, line, polygon, star, text) |
| `render` | Render JSX to design nodes |
| `create_component` | Convert frame to component |
| `create_instance` | Create a component instance |

#### Modify (10 tools)

| Tool | Description |
|------|-------------|
| `set_fill` | Set fill color |
| `set_stroke` | Set stroke color and weight |
| `set_effects` | Set effects (shadow, blur) |
| `update_node` | Update node properties (position, size, text, etc.) |
| `set_layout` | Set auto-layout properties |
| `set_constraints` | Set resize constraints |
| `rename_node` | Rename a node |
| `reparent_node` | Move node to a different parent |
| `clone_node` | Duplicate a node |
| `delete_node` | Delete a node |

#### Organize (4 tools)

| Tool | Description |
|------|-------------|
| `select_nodes` | Set selection |
| `group_nodes` | Group nodes |
| `ungroup_node` | Ungroup |
| `switch_page` | Switch to a different page |

#### Escape hatch (1 tool)

| Tool | Description |
|------|-------------|
| `eval_code` | Execute code with Figma-compatible plugin API |

### Prototyping (planned)

| Feature | Description |
|---------|-------------|
| Connections | Link frames with interaction triggers |
| Triggers | Click, hover, press, mouse enter/leave, after delay, drag |
| Actions | Navigate to, overlay, swap, back, scroll to, open URL |
| Transitions | Instant, dissolve, smart animate, move in/out, push, slide |
| Easing | Linear, ease-in, ease-out, ease-in-out, spring, custom bezier |
| Preview | Play prototype in browser |
| Device frames | iPhone, Android, Desktop, custom sizes |

---

---

## Technical Deep Dive

### Scene Graph

The scene graph is a tree of nodes. Every node is identified by a GUID (`sessionID:localID`) and has a parent reference via `ParentIndex` (parent GUID + position string for z-ordering).

We reuse Figma's proven schema — 194 message/enum/struct definitions, with `NodeChange` as the central type (~390 fields after removing deprecated tag fields).

#### Node hierarchy

```
Document
└── Canvas (page)
    ├── Frame
    │   ├── Rectangle
    │   ├── Text
    │   └── Frame (nested)
    │       ├── Ellipse
    │       └── Instance (→ references Component)
    ├── Component
    │   └── ...children (the main component definition)
    ├── Section
    │   └── Frame
    ├── Group
    │   └── ...children
    └── BooleanOperation
        └── ...operand shapes
```

#### Node types (29, from Figma Kiwi schema)

| Type | ID | Description |
|------|----|-------------|
| DOCUMENT | 1 | Root, one per file |
| CANVAS | 2 | Page |
| GROUP | 3 | Group container |
| FRAME | 4 | Primary container (artboard), supports auto-layout |
| BOOLEAN_OPERATION | 5 | Union/subtract/intersect/exclude result |
| VECTOR | 6 | Freeform vector path |
| STAR | 7 | Star shape |
| LINE | 8 | Line |
| ELLIPSE | 9 | Ellipse/circle, supports arc data |
| RECTANGLE | 10 | Rectangle |
| REGULAR_POLYGON | 11 | Regular polygon (3-12 sides) |
| ROUNDED_RECTANGLE | 12 | Rectangle with smooth corners |
| TEXT | 13 | Text with rich formatting |
| SLICE | 14 | Export region |
| SYMBOL | 15 | Component (main) |
| INSTANCE | 16 | Component instance |
| STICKY | 17 | FigJam sticky note |
| SHAPE_WITH_TEXT | 18 | FigJam shape |
| CONNECTOR | 19 | Connector line between nodes |
| CODE_BLOCK | 20 | FigJam code block |
| WIDGET | 21 | Plugin widget |
| STAMP | 22 | FigJam stamp |
| MEDIA | 23 | Video/GIF |
| HIGHLIGHT | 24 | FigJam highlight |
| SECTION | 25 | Canvas section (organizational) |
| SECTION_OVERLAY | 26 | Section overlay |
| WASHI_TAPE | 27 | FigJam washi tape |
| VARIABLE | 28 | Variable definition node |

#### Core node properties

Every node carries these fields (subset of NodeChange):

```
Identity:     guid, type, name, phase (CREATED/REMOVED)
Tree:         parentIndex (parent GUID + position string)
Transform:    size (Vector), transform (2x3 Matrix), rotation
Appearance:   fillPaints[], strokePaints[], effects[], opacity, blendMode
Stroke:       strokeWeight, strokeAlign, strokeCap, strokeJoin, dashPattern[]
              borderTopWeight, borderBottomWeight, borderLeftWeight, borderRightWeight
              borderStrokeWeightsIndependent
Corners:      cornerRadius, cornerSmoothing
              rectangleTopLeftCornerRadius, rectangleTopRightCornerRadius
              rectangleBottomLeftCornerRadius, rectangleBottomRightCornerRadius
              rectangleCornerRadiiIndependent
Visibility:   visible, locked
Constraints:  horizontalConstraint, verticalConstraint
```

Type-specific fields:

```
Text:         textData (characters, styleOverrides, baselines, glyphs)
              fontSize, fontName, lineHeight, letterSpacing, paragraphSpacing
              textAlignHorizontal, textAlignVertical, textAutoResize, textTruncation
              textCase, textDecoration, textListData
              fontVariant* (ligatures, numeric, caps, position)
              fontVariations[], hyperlink
Vector:       vectorData (vectorNetworkBlob, normalizedSize)
              fillGeometry[], strokeGeometry[]
              handleMirroring, arcData (for ellipse arcs)
Star:         starInnerScale, count (point count)
Component:    symbolData, componentKey, symbolDescription
              componentPropDefs[], isSymbolPublishable
              sharedComponentMasterData, sharedSymbolMappings[]
Instance:     overriddenSymbolID, symbolData.symbolOverrides[]
              componentPropRefs[], componentPropAssignments[]
              overrideStash[], propsAreBubbled
Layout:       stackMode (NONE/HORIZONTAL/VERTICAL)
              stackSpacing, stackPadding, stackHorizontalPadding, stackVerticalPadding
              stackPaddingRight, stackPaddingBottom
              stackJustify, stackCounterAlign, stackCounterAlignItems
              stackPrimaryAlignItems, stackPositioning, stackReverseZIndex
              stackPrimarySizing, stackCounterSizing, stackChildPrimaryGrow
              stackChildAlignSelf
              bordersTakeSpace, resizeToFit
Grid:         gridRowCount, gridColumnCount
              gridRowGap, gridColumnGap
              gridColumnSizes[], gridRowSizes[] (GridTrackSize: type + value)
Styles:       inheritFillStyleID, inheritStrokeStyleID, inheritTextStyleID
              inheritEffectStyleID, inheritGridStyleID
              styleType, styleDescription
Prototype:    prototypeInteractions[] (event + actions[])
              transitionNodeID, transitionType, transitionDuration, easingType
              overlayPositionType, overlayRelativePosition
              prototypeStartingPoint, prototypeStartNodeID
Variables:    variableData (value + dataType for BOOLEAN/FLOAT/STRING)
              Paint.variableBinding (binds fill/stroke color to variable GUID)
Export:       exportSettings[], exportBackgroundDisabled
Plugin:       pluginData[], pluginRelaunchData[]
Accessibility: ariaRole, accessibleLabel
Connectors:   connectorStart, connectorEnd, connectorLineStyle
              connectorStartCap, connectorEndCap, connectorControlPoints[]
```

#### Paint (fill/stroke)

```
Paint {
  type:       SOLID | GRADIENT_LINEAR | GRADIENT_RADIAL | GRADIENT_ANGULAR
              | GRADIENT_DIAMOND | IMAGE | EMOJI | VIDEO
  color:      {r, g, b, a} (0-1 floats)
  opacity:    0-1
  visible:    bool
  blendMode:  NORMAL | MULTIPLY | SCREEN | ... (18 modes)
  stops:      ColorStop[] (for gradients: color + position)
  transform:  Matrix (for gradient/image positioning)
  image:      Image{hash, name, dataBlob}
  imageScaleMode: TILE | FILL | FIT | CROP
  paintFilter: tint, shadows, highlights, exposure, temperature, vibrance, contrast
  variableBinding: PaintVariableBinding (binds color to variable GUID)
}
```

#### Effect

```
Effect {
  type:       INNER_SHADOW | DROP_SHADOW | FOREGROUND_BLUR | BACKGROUND_BLUR
  color:      {r, g, b, a}
  offset:     {x, y}
  radius:     float (blur radius)
  spread:     float (shadow spread)
  visible:    bool
  blendMode:  BlendMode
  showShadowBehindNode: bool
}
```

#### In-memory representation

Nodes live in a flat `Map<string, Node>` keyed by GUID string. The tree structure is maintained via `parentIndex` references. This gives O(1) lookup by ID and efficient traversal.

```typescript
interface SceneGraph {
  nodes: Map<string, Node>
  root: string                    // Document GUID
  
  getNode(id: string): Node
  getChildren(id: string): Node[] // Sorted by position string
  getParent(id: string): Node | null
  
  createNode(type: NodeType, parent: string, props: Partial<NodeChange>): Node
  updateNode(id: string, changes: Partial<NodeChange>): void
  deleteNode(id: string): void
  moveNode(id: string, newParent: string, position: string): void
  
  // Queries
  findByType(type: NodeType): Node[]
  findByName(pattern: string): Node[]
  hitTest(point: Vector, canvas: string): Node | null
  getNodesInRect(rect: Rect, canvas: string): Node[]
}
```

### Undo/Redo

Figma's own approach (visible in the Message schema): `Message.localUndoStack` and `Message.localRedoStack` — each undo entry is a full `Message` containing the inverse `NodeChange[]`.

We use the same **inverse command** pattern:

```typescript
interface UndoEntry {
  label: string                   // "Create Rectangle", "Change fill", etc.
  forward: NodeChange[]           // Changes to apply
  inverse: NodeChange[]           // Changes to revert (auto-computed)
  timestamp: number
}

interface UndoManager {
  undoStack: UndoEntry[]
  redoStack: UndoEntry[]
  
  apply(changes: NodeChange[], label: string): void  // Pushes inverse onto undoStack
  undo(): void                                        // Pops undoStack, pushes to redoStack
  redo(): void                                        // Pops redoStack, pushes to undoStack
  
  beginBatch(label: string): void  // Group multiple changes into one undo step
  commitBatch(): void
}
```

How inverse computation works:

| Operation | Forward | Inverse |
|-----------|---------|---------|
| Create node | `{guid, phase: CREATED, ...props}` | `{guid, phase: REMOVED}` |
| Delete node | `{guid, phase: REMOVED}` | `{guid, phase: CREATED, ...allProps}` (snapshot) |
| Change prop | `{guid, fill: "#F00"}` | `{guid, fill: "#00F"}` (previous value) |
| Move node | `{guid, parentIndex: newParent}` | `{guid, parentIndex: oldParent}` |
| Reparent | `{guid, parentIndex: newParent}` | `{guid, parentIndex: oldParent}` |

Before applying any change, we snapshot the affected fields. The snapshot becomes the inverse. This is simple, correct, and the exact pattern Figma uses.

**Batching:** operations like "drag to move" produce hundreds of position changes per second. We debounce into a single undo entry. `beginBatch`/`commitBatch` wraps multi-step operations (e.g., "create component" = create frame + set symbolData + create children).

### Figma Compatibility & Pixel-Perfect Testing

The goal: open any `.fig` file and render it identically to Figma.

#### .fig file format

```
┌─────────────────────────────────┐
│ Magic header: "fig-kiwi" (8B)   │
│ Version (4B uint32 LE)          │
│ Schema length (4B uint32 LE)    │
│ Compressed Kiwi schema          │
│ Message length (4B uint32 LE)   │
│ Compressed Kiwi message         │  ← NodeChange[] (the entire document)
│ Blob data                       │  ← Images, vector networks, fonts
└─────────────────────────────────┘
```

We already have the full pipeline from figma-use:
- **Kiwi schema**: 194 definitions, 2178 lines (in git: `9216dcc^:packages/cli/src/multiplayer/schema.ts`)
- **Codec**: encode/decode Messages with Kiwi, Zstd compress/decompress (`codec.ts`, 546 lines)
- **Protocol**: wire format parsing, message type detection (`protocol.ts`, 238 lines)
- **Client**: WebSocket multiplayer connection (`client.ts`, 351 lines)

#### Import pipeline

```
.fig file
  → parse header (magic + version)
  → decompress Zstd
  → decode Kiwi schema
  → decode Message → NodeChange[]
  → build SceneGraph (flat map of nodes)
  → resolve blob references (images, vector networks)
  → apply to OpenPencil scene graph
```

#### Rendering compatibility

Both OpenPencil and Figma use Skia CanvasKit for rendering. This means identical rendering primitives. The pixel-perfect challenge is in:

1. **Layout computation** — auto-layout (flexbox) results must match exactly. Using Yoga helps since Figma's layout is also CSS-flexbox-based, but we need to verify edge cases.
2. **Text shaping** — same font + same Skia text shaper = same glyphs. We must use the same fonts (embedded in .fig blobs or loaded from the same sources).
3. **Effect rendering** — shadows, blurs, blend modes are Skia-native, should match.
4. **Vector path rendering** — vector networks are stored as blobs, need exact reproduction of fill/stroke geometry.
5. **Corner smoothing** — Figma's "smooth corners" (squircle) uses `cornerSmoothing` (0-1). Skia doesn't have native squircle — needs a custom path approximation matching Figma's implementation.
6. **Subpixel positioning** — rounding differences at fractional coordinates.

#### Fuzzy pixel-perfect test suite

```
Crawl Figma files → for each:
  1. Export from Figma (via REST API or screenshot):
     figma-use export node <id> --scale 2 --output expected.png
  
  2. Import .fig into OpenPencil
  
  3. Render same node in OpenPencil:
     openpencil render <id> --scale 2 --output actual.png
  
  4. Compare with pixelmatch:
     - Threshold: 0.1 (allow minor subpixel differences)
     - Report: diff percentage, diff image, failing regions
     - Pass if < 0.5% pixels differ
```

**Test corpus structure:**

```
tests/figma-compat/
├── corpus/
│   ├── basic-shapes.fig          # Rectangles, ellipses, lines, stars, polygons
│   ├── auto-layout.fig           # Flexbox: horizontal, vertical, nested, wrap
│   ├── grid-layout.fig           # CSS Grid layouts
│   ├── text-styles.fig           # Fonts, sizes, line heights, letter spacing, mixed styles
│   ├── effects.fig               # Shadows, blurs, blend modes
│   ├── gradients.fig             # Linear, radial, angular, diamond, image fills
│   ├── components.fig            # Components, instances, overrides, variants
│   ├── constraints.fig           # Pin constraints, scale, fill container
│   ├── vectors.fig               # Pen tool paths, boolean operations
│   ├── corner-smoothing.fig      # Squircle / smooth corners at various values
│   ├── masks.fig                 # Mask layers, outline masks
│   ├── variables.fig             # Variable-bound fills, strokes, text
│   └── real-world/
│       ├── landing-page.fig
│       ├── mobile-app.fig
│       └── design-system.fig
├── expected/                     # Screenshots from Figma (ground truth)
│   ├── basic-shapes/
│   │   ├── node-1-2.png
│   │   └── ...
├── actual/                       # Screenshots from OpenPencil (test run)
├── diffs/                        # Visual diffs
└── report.html                   # Test report with side-by-side comparison
```

**CI pipeline:**

```bash
# 1. Crawl: download .fig files and export screenshots from Figma
bun run test:figma:crawl

# 2. Render: import .fig into OpenPencil, render same nodes
bun run test:figma:render

# 3. Compare: pixel diff with threshold
bun run test:figma:compare

# 4. Report: generate HTML report with failures
bun run test:figma:report
```

**Compatibility tiers:**

| Tier | Requirement | What it covers |
|------|-------------|----------------|
| T0 | Exact pixels | Basic shapes, solid fills, positioning, sizing |
| T1 | < 0.1% diff | Auto-layout, text (minor font hinting differences) |
| T2 | < 0.5% diff | Effects, gradients, masks |
| T3 | < 1% diff | Complex components, real-world files |
| T4 | Visual match | Corner smoothing, subpixel rendering edge cases |

### Layout Engine: Yoga

Based on our research, **Yoga** is the right choice now:

- **CSS Grid support is landing** — [facebook/yoga#1893](https://github.com/facebook/yoga/pull/1893)–#1902 (9 PRs by @intergalacticspacehighway from Expo)
  - PR 1/9 (style types & public API) under active review by NickGerleman (Meta), last activity Feb 28, 2026
  - Supported: `grid-template-columns/rows`, `grid-column/row-start/end`, `grid-auto-columns/rows`, `minmax()`, `auto`, `%`, `px`, `fr`
  - Not yet: `repeat()`, `auto-fill`/`auto-fit`, `grid-template-areas`, `grid-auto-flow`, subgrid
- Battle-tested in React Native (billions of devices)
- ~45KB WASM, well-maintained by Meta
- Flexbox + Grid covers everything a design tool needs
- No need to maintain a custom layout engine

We'll wrap Yoga with a thin adapter that speaks our property names (`fill_container` → `flex-grow:1`, `fit_content` → `auto`).

Mapping Figma layout fields to Yoga:

| Figma (NodeChange field) | Yoga equivalent |
|---|---|
| `stackMode: HORIZONTAL` | `flexDirection: row` |
| `stackMode: VERTICAL` | `flexDirection: column` |
| `stackSpacing` | `gap` |
| `stackPadding` / `stackHorizontalPadding` / `stackVerticalPadding` / `stackPaddingRight` / `stackPaddingBottom` | `padding*` |
| `stackJustify` (MIN/CENTER/MAX/SPACE_BETWEEN) | `justifyContent` |
| `stackCounterAlign` / `stackCounterAlignItems` | `alignItems` |
| `stackPrimarySizing: FIXED/HUG/FILL` | `width/height: fixed/auto/flex-grow` |
| `stackCounterSizing: FIXED/HUG/FILL` | Cross-axis sizing |
| `stackChildPrimaryGrow` | `flexGrow` |
| `stackChildAlignSelf` | `alignSelf` |
| `stackPositioning: ABSOLUTE` | `position: absolute` |
| `gridRowCount` / `gridColumnCount` | CSS Grid `grid-template-rows/columns` count |
| `gridRowGap` / `gridColumnGap` | `row-gap` / `column-gap` |
| `gridColumnSizes[]` / `gridRowSizes[]` | `grid-template-columns/rows` (track sizes) |

### File Format: Kiwi binary

We already have the full Kiwi codec from figma-use. The `.openpencil` format will use the same encoding:

- Kiwi binary schema (compact, fast parsing)
- Zstd compression
- Same NodeChange-based structure (proven at Figma scale)
- Superset of .fig — we add our own fields but can read Figma files

Migration from .fig: decode with our Kiwi codec → re-encode as .openpencil.

### Collaboration (P2P CRDT)

Fully peer-to-peer via Trystero (WebRTC). No relay server — signaling via MQTT public brokers, data direct between peers.

- Yjs CRDT for document state sync
- Awareness protocol for cursors, selections, presence, follow mode
- y-indexeddb for local persistence — room survives page refresh
- ICE servers: Google STUN + Cloudflare STUN + Open Relay TURN (TCP + UDP)
- Secure room IDs via `crypto.getRandomValues()`
- Stale cursors cleaned on peer disconnect

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Rendering | Skia CanvasKit WASM | Same as Figma/Pencil, proven performance |
| UI | Vue 3 + TypeScript | Reactivity, composables, SFC ecosystem |
| Styling | Tailwind CSS 4 | Fast iteration |
| State | Vue reactivity + composables | Native to the framework, zero boilerplate |
| Layout | Yoga WASM | Flexbox, battle-tested (CSS Grid blocked on upstream) |
| Desktop | Tauri v2 | ~7MB vs Electron's ~100MB, Rust backend |
| AI | Vercel AI SDK + OpenRouter | Client-side tool use, no backend |
| Collaboration | Trystero (WebRTC) + Yjs (CRDT) | P2P sync, no server required |
| File format | Kiwi binary + Zstd | Compact, fast, .fig compatible |
| Build | Bun + Vite 7 | Fast bundling, native TS |

## Phases

### Phase 1: Core engine ✅

SceneGraph, Skia rendering, basic shapes, selection, zoom/pan, undo/redo.

### Phase 2: Editor UI + Layout ✅

Properties panel, layers panel, toolbar, Yoga layout integration, text editing, pen tool with vector networks.

### Phase 3: File format + Import/Export ✅

.fig import and export via Kiwi binary codec, Figma clipboard interop, PNG/JPG/WEBP export.

### Phase 4: Components + Variables ✅

Components, instances, component sets with live sync and override preservation. Variables with collections, modes, color bindings, alias chains.

### Phase 5: AI integration ✅

In-app AI chat (⌘J) with OpenRouter, 10 tools, streaming responses with tool call timeline. JSX renderer. Code panel with JSX export.

### Phase 6: Collaboration ✅

P2P real-time collaboration via Trystero (WebRTC) + Yjs CRDT. Cursors, presence, follow mode. No server required.

### Phase 7: Distribution ✅

Tauri v2 desktop app (macOS, Windows, Linux). Web app at app.openpencil.dev. CLI published on npm. Documentation site at openpencil.dev. GitHub Actions CI for builds and deploys.

### What's next

- **Multi-file / tabs** — open multiple documents in tabs within a single window
- **More AI providers** — Anthropic API, Claude Code subscription, Gemini, local models via Ollama
- **Code signing** — Apple & Azure certificates for properly signed desktop binaries
- **.fig compatibility** — improving import/export fidelity across a larger set of real-world files
- **Port all figma-use tools** — bring the full 118-tool set from [figma-use](https://github.com/dannote/figma-use) into the editor (currently 38/118) for complete AI agent design capabilities
- **CI tools** — design linting, code export, visual regression in pipelines via the headless CLI
- **Prototyping** — frame transitions, interaction triggers, preview mode
- **SVG/PDF export** — vector export formats

---

## CLI & Headless Mode

The CLI (`@open-pencil/cli`) runs headless in Bun — loads the engine directly, no window, no Tauri, no WebGL. CanvasKit WASM CPU software rasterizer enables PNG export without a display server.

### Monorepo structure (implemented)

Bun workspace with three packages:

```
package.json              — workspace root
packages/
  core/                   — @open-pencil/core: scene graph, renderer, layout, codec, tools
  cli/                    — @open-pencil/cli: headless CLI (info, tree, find, export, analyze)
  docs/                   — VitePress documentation site
src/                      — Vue 3 + Tauri desktop editor (imports from @open-pencil/core)
desktop/                  — Tauri v2 Rust backend
tests/
  e2e/                    — Playwright visual regression
  engine/                 — bun:test unit tests
```

### Kiwi decoder performance — investigated

We benchmarked the Rust `kiwi-schema` crate (by Evan Wallace, 1.5M downloads) against our JS decoder:

| File | JS (Bun) | Rust (native) |
|------|----------|---------------|
| material3 (87K nodes, 44.7 MB) | **168 ms** | 595 ms |
| nuxtui (315K nodes, 229 MB) | **785 ms** | 4,215 ms |

**JS is 3.5–5.4x faster.** The Rust crate uses dynamic `Value` enum with `HashMap<&str, Value>` per object — heap allocations for every field of every node. Our JS decoder uses `compileSchema()` which generates specialized decode functions via `new Function()` — the JIT optimizes these into near-native code with zero boxing overhead.

A faster Rust/WASM decoder would require code generation (like protobuf's `prost` with derive macros) to emit typed structs instead of dynamic `Value`. Not worth the effort given our JS decoder already handles 315K nodes in under a second.

**The real bottleneck was O(n²) `getChildren()` in `importNodeChanges`** (scanning all parent entries for each node). Fixed by building a `childrenMap` index upfront → **69x speedup** (37s → 535ms for material3).

### Risks — all validated

- **CanvasKit WASM in Bun** ✅ — CPU surface works headless for CLI export
- **Font loading in headless** ✅ — system fonts loaded via `readFileSync` + `FontMgr.FromData()`
- **Core extraction** ✅ — engine is `@open-pencil/core` with zero DOM deps, used by both app and CLI
- **Kiwi codec performance** ✅ — JS decoder is 3.5–5.4x faster than Rust kiwi-schema crate (JIT-compiled `new Function()` vs dynamic `Value` with HashMap)
- **P2P collaboration** ✅ — Trystero + Yjs works without a relay server

---

## Keyboard Shortcuts Reference

Full Figma-compatible shortcut map. Implemented shortcuts marked with ✅.

### Tools (single key, no modifier)

| Key | Tool | Status |
|-----|------|--------|
| V | Move/Select | ✅ |
| K | Scale | |
| H | Hand | ✅ |
| F | Frame | ✅ |
| S | Section / Slice | |
| R | Rectangle | ✅ |
| O | Ellipse | ✅ |
| L | Line | ✅ |
| ⇧L | Arrow | |
| P | Pen | |
| ⇧P | Pencil | |
| T | Text | ✅ |
| C | Comment | |
| I | Eyedropper | |

### File

| Shortcut | Action | Status |
|----------|--------|--------|
| ⌘N | New Window | |
| ⌘O | Open File | ✅ |
| ⌘W | Close Tab | |
| ⌘S | Save | |
| ⇧⌘E | Export… | |

### Edit

| Shortcut | Action | Status |
|----------|--------|--------|
| ⌘Z | Undo | ✅ |
| ⇧⌘Z | Redo | ✅ |
| ⌘X | Cut | |
| ⌘C | Copy | |
| ⌘V | Paste | |
| ⇧⌘V | Paste Over Selection | |
| ⌘D | Duplicate | ✅ |
| ⌫ | Delete | ✅ |
| ⌘A | Select All | ✅ |
| ⇧⌘A | Select Inverse | |
| ⌥⌘C | Copy Properties | |
| ⌥⌘V | Paste Properties | |
| ⌃C | Pick Color (Eyedropper) | |

### View

| Shortcut | Action | Status |
|----------|--------|--------|
| ⌘' | Pixel Grid | |
| ⌃G | Layout Guides | |
| ⇧R | Rulers | |
| ⌘\ | Show/Hide UI | |
| ⌘= | Zoom In | ✅ |
| ⌘- | Zoom Out | ✅ |
| ⌘0 | Zoom to 100% | ✅ |
| ⌘1 | Zoom to Fit | |
| ⌘2 | Zoom to Selection | |
| N / ⇧N | Next/Previous Frame | |

### Object

| Shortcut | Action | Status |
|----------|--------|--------|
| ⌥⌘G | Frame Selection | |
| ⌘G | Group Selection | |
| ⇧⌘G | Ungroup | |
| ⇧A | Add Auto Layout | |
| ⌥⌘K | Create Component | |
| ⌥⌘B | Detach Instance | |
| ⌘] | Bring Forward | |
| ⌥⌘] | Bring to Front | |
| ⌘[ | Send Backward | |
| ⌥⌘[ | Send to Back | |
| ⇧H | Flip Horizontal | |
| ⇧V | Flip Vertical | |
| ⌘E | Flatten | |
| ⇧⌘H | Show/Hide Selection | |
| ⇧⌘L | Lock/Unlock Selection | |
| ⌥/ | Remove Fill | |
| ⇧X | Swap Fill and Stroke | |

### Text

| Shortcut | Action | Status |
|----------|--------|--------|
| ⌘B | Bold | |
| ⌘I | Italic | |
| ⌘U | Underline | |
| ⇧⌘X | Strikethrough | |
| ⇧⌘U | Create Link | |

### Arrange

| Shortcut | Action | Status |
|----------|--------|--------|
| ⌥A | Align Left | |
| ⌥H | Align Horizontal Centers | |
| ⌥D | Align Right | |
| ⌥W | Align Top | |
| ⌥V | Align Vertical Centers | |
| ⌥S | Align Bottom | |
| ⌥⇧H | Distribute Horizontal Spacing | |
| ⌥⇧V | Distribute Vertical Spacing | |

### Canvas Interaction

| Input | Action | Status |
|-------|--------|--------|
| Click | Select node | ✅ |
| Shift+Click | Add/remove from selection | ✅ |
| Alt+Drag | Duplicate and move | ✅ |
| Shift+Drag (draw) | Constrain to square/circle | ✅ |
| Shift+Drag (resize) | Maintain aspect ratio | ✅ |
| Shift+Drag (rotate) | Snap to 15° | ✅ |
| Middle mouse drag | Pan | ✅ |
| Scroll | Pan | ✅ |
| Ctrl+Scroll / Pinch | Zoom | ✅ |
| Double-click text | Edit text inline | ✅ |
| Drag onto frame | Reparent into frame | ✅ |
| Escape | Deselect / Cancel | ✅ |

---

*Created: 2026-02-26 · Updated: 2026-03-02*
