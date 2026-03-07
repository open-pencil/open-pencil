# `open-pencil eval` — Figma-like Plugin API for Headless Scripting

## Overview

`bun open-pencil eval <file> --code '<js>'` executes JavaScript against a `.fig` file with a Figma-compatible `figma` global object. This enables headless scripting, batch operations, AI tool execution, and testing — all without the GUI.

The `figma` object mirrors Figma's Plugin API surface as closely as possible, so existing Figma plugin knowledge and code snippets transfer directly.

```bash
# Create a frame, set auto-layout, add children
bun open-pencil eval design.fig --code '
  const frame = figma.createFrame()
  frame.name = "Card"
  frame.resize(300, 200)
  frame.layoutMode = "VERTICAL"
  frame.itemSpacing = 12
  frame.paddingTop = frame.paddingBottom = 16
  frame.paddingLeft = frame.paddingRight = 16
  frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }]

  const title = figma.createText()
  title.characters = "Hello World"
  title.fontSize = 24
  frame.appendChild(title)

  return { id: frame.id, name: frame.name }
'

# Query nodes
bun open-pencil eval design.fig --code '
  const buttons = figma.currentPage.findAll(n => n.type === "FRAME" && n.name.includes("Button"))
  return buttons.map(b => ({ id: b.id, name: b.name, w: b.width, h: b.height }))
'

# Read from stdin (for multiline scripts / piping)
cat transform.js | bun open-pencil eval design.fig --stdin

# Write changes back
bun open-pencil eval design.fig --code '...' --write
bun open-pencil eval design.fig --code '...' -o modified.fig
```

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  CLI: `open-pencil eval <file> --code '...'`         │
│    ↓                                                 │
│  loadDocument(file) → SceneGraph                     │
│    ↓                                                 │
│  FigmaAPI(sceneGraph) → `figma` proxy object         │
│    ↓                                                 │
│  AsyncFunction('figma', wrappedCode)(figmaProxy)     │
│    ↓                                                 │
│  print result as JSON / agentfmt                     │
│  optionally: saveDocument(file) if --write           │
└──────────────────────────────────────────────────────┘
```

### Key classes

| Class | Location | Role |
|-------|----------|------|
| `FigmaAPI` | `packages/core/src/figma-api.ts` | Proxy object implementing `figma.*` methods against `SceneGraph` |
| `FigmaNode` | `packages/core/src/figma-api.ts` | Proxy wrapping `SceneNode` with Figma-style property access (`.fills`, `.resize()`, `.appendChild()`, etc.) |
| `eval` command | `packages/cli/src/commands/eval.ts` | CLI command that loads doc, creates API, executes code |

### Why in `@open-pencil/core`?

The `FigmaAPI` class lives in core (not CLI) because:
- **AI tools reuse it** — the chat panel's `render` tool can execute JSX through the same API
- **Test scripts** — unit tests can use the API to set up fixtures
- **No DOM deps** — runs headless in Bun, no browser APIs needed

## `FigmaAPI` — Phased Implementation

### Phase 1: Core (MVP for eval command)

These cover ~80% of real plugin scripts:

#### Document & Page

| Figma API | Our implementation | Notes |
|-----------|--------------------|-------|
| `figma.root` | Getter → proxy for root node | `.children` returns page proxies |
| `figma.currentPage` | Getter/setter → first page by default | Settable to any page proxy |
| `figma.currentPage.selection` | Get/set → tracked selection array | |
| `figma.getNodeById(id)` | `graph.getNode(id)` wrapped in proxy | Sync, like Figma's deprecated version |

#### Node Creation

| Figma API | Maps to |
|-----------|---------|
| `figma.createFrame()` | `graph.createNode('FRAME', currentPageId)` |
| `figma.createRectangle()` | `graph.createNode('RECTANGLE', ...)` |
| `figma.createEllipse()` | `graph.createNode('ELLIPSE', ...)` |
| `figma.createText()` | `graph.createNode('TEXT', ...)` |
| `figma.createLine()` | `graph.createNode('LINE', ...)` |
| `figma.createPolygon()` | `graph.createNode('POLYGON', ...)` |
| `figma.createStar()` | `graph.createNode('STAR', ...)` |
| `figma.createComponent()` | `graph.createNode('COMPONENT', ...)` |
| `figma.createPage()` | `graph.addPage(name)` |
| `figma.createSection()` | `graph.createNode('SECTION', ...)` |

#### Node Properties (via `FigmaNode` proxy)

Read/write on any node proxy. Property access maps to `SceneNode` fields:

```ts
// Geometry
node.x, node.y              // direct
node.width, node.height      // read-only, use node.resize(w, h)
node.rotation                // direct
node.resize(w, h)            // updates width + height
node.resizeWithoutConstraints(w, h) // same (no constraint engine yet)

// Visual
node.fills                   // get/set Fill[]
node.strokes                 // get/set Stroke[]
node.effects                 // get/set Effect[]
node.opacity                 // get/set number
node.visible                 // get/set boolean
node.locked                  // get/set boolean
node.blendMode               // get/set BlendMode
node.clipsContent            // get/set boolean

// Corner radius
node.cornerRadius            // get/set (number or figma.mixed)
node.topLeftRadius           // get/set
node.topRightRadius          // get/set
node.bottomLeftRadius        // get/set
node.bottomRightRadius       // get/set
node.cornerSmoothing         // get/set

// Identity
node.id                      // read-only
node.name                    // get/set
node.type                    // read-only
node.parent                  // read-only → FigmaNode | null
node.removed                 // read-only boolean
```

#### Tree Operations

```ts
node.children                // read-only FigmaNode[]
node.appendChild(child)      // reparent to end
node.insertChild(index, child) // reparent at index
node.remove()                // graph.deleteNode(id)

// Traversal
node.findAll(callback?)      // recursive find
node.findOne(callback)       // first match
node.findChild(callback)     // direct children only
node.findChildren(callback?) // direct children only
```

#### Auto-layout

```ts
node.layoutMode              // 'NONE' | 'HORIZONTAL' | 'VERTICAL'
node.primaryAxisAlignItems   // 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'
node.counterAxisAlignItems   // 'MIN' | 'CENTER' | 'MAX' | 'BASELINE'
node.itemSpacing             // number
node.counterAxisSpacing      // number | null
node.paddingTop / Right / Bottom / Left  // number
node.layoutWrap              // 'NO_WRAP' | 'WRAP'

// Child sizing
node.layoutPositioning       // 'AUTO' | 'ABSOLUTE'
node.layoutGrow              // 0 | 1
node.layoutSizingHorizontal  // 'FIXED' | 'HUG' | 'FILL'
node.layoutSizingVertical    // 'FIXED' | 'HUG' | 'FILL'
```

#### Text

```ts
node.characters              // get/set (maps to node.text)
node.fontSize                // get/set
node.fontName                // get/set { family, style }
node.fontWeight              // get/set
node.textAlignHorizontal     // get/set
node.textAlignVertical       // get/set
node.textAutoResize          // get/set
node.letterSpacing           // get/set
node.lineHeight              // get/set
node.maxLines                // get/set
node.textCase                // get/set
node.textDecoration          // get/set
```

#### Stroke details

```ts
node.strokeWeight            // get/set (maps to strokes[0].weight)
node.strokeAlign             // get/set (maps to strokes[0].align)
node.dashPattern             // get/set
```

#### Misc

```ts
figma.mixed                  // Symbol sentinel for mixed values
figma.group(nodes, parent)   // creates GROUP with given children
figma.ungroup(node)          // ungroups, reparents children
figma.flatten(nodes)         // NOT IMPLEMENTED YET — returns first node
```

#### Export

```ts
node.exportAsync(settings?)  // only works if CanvasKit is loaded
                             // settings: { format: 'PNG'|'JPG'|'SVG', constraint? }
```

### Phase 2: Components & Instances

| API | Maps to |
|-----|---------|
| `figma.createComponent()` | `graph.createNode('COMPONENT', ...)` |
| `figma.createComponentFromNode(node)` | Convert existing frame to component |
| `figma.combineAsVariants(components, parent)` | Create COMPONENT_SET |
| Node: `node.createInstance()` | `graph.createInstance(componentId, parentId)` |
| Node: `node.detachInstance()` | `graph.detachInstance(id)` |
| `figma.getNodeById(id).mainComponent` | `graph.getMainComponent(id)` |

### Phase 3: Variables

| API | Maps to |
|-----|---------|
| `figma.variables.getLocalVariables(type?)` | `graph.variables` filtered |
| `figma.variables.getLocalVariableCollections()` | `graph.variableCollections` |
| `figma.variables.createVariable(name, collection, type)` | `graph.addVariable(...)` |
| `figma.variables.createVariableCollection(name)` | `graph.addCollection(...)` |
| `figma.variables.getVariableById(id)` | `graph.variables.get(id)` |
| `node.setBoundVariable(field, variable)` | `graph.bindVariable(...)` |
| `node.boundVariables` | getter from SceneNode |

### Phase 4: Styles & Advanced

| API | Notes |
|-----|-------|
| `figma.createPaintStyle()` | Requires style storage in SceneGraph |
| `figma.createTextStyle()` | Requires style storage in SceneGraph |
| `figma.createEffectStyle()` | Requires style storage in SceneGraph |
| `figma.loadFontAsync(fontName)` | No-op (we don't have font loading constraints) |
| `figma.listAvailableFontsAsync()` | Return system fonts if available |
| Boolean operations (`union`, `subtract`, `intersect`, `exclude`) | Requires path boolean engine |
| `figma.createNodeFromJSXAsync(jsx)` | Port figma-use's JSX renderer |

## `FigmaNode` Proxy Design

The proxy wraps a `SceneNode` and translates Figma property names to our internal names. Key mappings:

```ts
const PROPERTY_MAP: Record<string, string> = {
  // Figma name → SceneNode field name (only where they differ)
  'characters': 'text',
  'strokeWeight': → computed from strokes[0].weight,
  'strokeAlign': → computed from strokes[0].align,
  'fontName': → computed from { family: fontFamily, style: ... },
  'primaryAxisAlignItems': 'primaryAxisAlign',
  'counterAxisAlignItems': 'counterAxisAlign',
  'primaryAxisSizingMode': 'primaryAxisSizing',    // value mapping: 'AUTO' → 'HUG', 'FIXED' → 'FIXED'
  'counterAxisSizingMode': 'counterAxisSizing',
  'layoutSizingHorizontal': → computed from primaryAxisSizing / counterAxisSizing depending on layoutMode
  'layoutSizingVertical': → computed
}
```

Methods on the proxy:

```ts
class FigmaNode {
  // The proxy is created via: new Proxy(target, handler)
  // where handler.get intercepts property reads and handler.set intercepts writes

  resize(width: number, height: number): void
  resizeWithoutConstraints(width: number, height: number): void
  remove(): void
  appendChild(child: FigmaNode): void
  insertChild(index: number, child: FigmaNode): void
  findAll(callback?: (node: FigmaNode) => boolean): FigmaNode[]
  findOne(callback: (node: FigmaNode) => boolean): FigmaNode | null
  findChild(callback: (node: FigmaNode) => boolean): FigmaNode | null
  findChildren(callback?: (node: FigmaNode) => boolean): FigmaNode[]
  exportAsync(settings?: ExportSettings): Promise<Uint8Array>

  // Components (Phase 2)
  createInstance(): FigmaNode
  detachInstance(): void
  get mainComponent(): FigmaNode | null
}
```

## CLI Command

```
bun open-pencil eval <file> [options]

Arguments:
  file            .fig file to operate on

Options:
  --code, -c      JavaScript code to execute (has access to `figma` global)
  --stdin         Read code from stdin instead of --code
  --write, -w     Write changes back to the input file
  -o, --output    Write to a different file
  --json          Output result as JSON (default for non-TTY)
  --quiet, -q     Suppress output, only write file
```

### Execution model

1. Load `.fig` → `SceneGraph`
2. Create `FigmaAPI(graph)` → `figma` proxy
3. Wrap user code in async function: `return (async () => { <code> })()`
4. Execute with `figma` as sole argument
5. Print return value (JSON or agentfmt)
6. If `--write` or `-o`: serialize `SceneGraph` back to `.fig`

### Return value formatting

- `undefined` / `void` → no output
- Primitives → printed directly
- Objects/arrays → `JSON.stringify(result, null, 2)` or agentfmt tables
- `FigmaNode` → serialized as `{ id, type, name, x, y, width, height, fills, ... }`
- Arrays of `FigmaNode` → serialized as list

## Shared with AI Tools

The `FigmaAPI` class is the **same API surface** that AI tools use. Currently `src/ai/tools.ts` calls `store.createShape()`, `store.updateNodeWithUndo()`, etc. — these should be refactored to go through `FigmaAPI`:

```ts
// Before (current AI tools)
execute: async ({ type, x, y, width, height }) => {
  const id = store.createShape(type, x, y, width, height)
  return { id }
}

// After (using FigmaAPI)
execute: async ({ type, x, y, width, height }) => {
  const frame = figma.createFrame()
  frame.resize(width, height)
  frame.x = x
  frame.y = y
  return { id: frame.id }
}
```

This ensures CLI scripts and AI tools behave identically.

## File Layout

```
packages/core/src/
  figma-api.ts          # FigmaAPI class + FigmaNode proxy (Phase 1–4)
  figma-api.test.ts     # Unit tests against headless SceneGraph

packages/cli/src/commands/
  eval.ts               # CLI command

packages/cli/src/commands/eval.test.ts  # Integration tests
```

## Test Plan

### Unit tests (`packages/core/src/figma-api.test.ts`)

1. **Node creation** — each `createX()` creates correct type, added to current page
2. **Property access** — `.fills`, `.x`, `.width`, `.name`, `.characters` read/write correctly
3. **Resize** — `.resize(w, h)` updates width/height
4. **Tree operations** — `.appendChild()`, `.insertChild()`, `.remove()`, `.parent`, `.children`
5. **Traversal** — `.findAll()`, `.findOne()`, `.findChild()`, `.findChildren()` with callbacks
6. **Auto-layout** — `.layoutMode`, `.itemSpacing`, `.paddingTop`, etc.
7. **Text** — `.characters` maps to `.text`, `.fontName` maps to `{ family, style }`
8. **Mixed values** — `.cornerRadius` returns `figma.mixed` when corners differ
9. **Selection** — `figma.currentPage.selection` get/set
10. **Page switching** — `figma.currentPage = page2` works
11. **Group/ungroup** — `figma.group()` creates group, `figma.ungroup()` dissolves it
12. **Clone** — node creation produces independent copies

### CLI integration tests (`packages/cli/src/commands/eval.test.ts`)

1. **Basic eval** — `eval test.fig --code 'return figma.currentPage.name'` → page name
2. **Create + read** — create a frame, return its properties
3. **Query nodes** — `findAll` returns correct nodes
4. **Write back** — `--write` saves changes, reloading shows them
5. **Stdin** — `echo 'return 42' | bun open-pencil eval test.fig --stdin` → `42`
6. **JSON output** — `--json` returns valid JSON
7. **Error handling** — syntax errors, runtime errors reported cleanly

## Implementation Order

1. **`FigmaNode` proxy** — property mapping, `.resize()`, `.remove()`, tree methods
2. **`FigmaAPI` class** — `createFrame/Rectangle/...`, `.root`, `.currentPage`, `.getNodeById()`, `.mixed`, `.group()`
3. **CLI `eval` command** — argument parsing, code wrapping, output formatting
4. **Unit tests** — all 12 test groups above
5. **CLI integration tests** — all 7 test groups above
6. **Wire to AI tools** — refactor `src/ai/tools.ts` to use `FigmaAPI` where possible
7. **Phase 2** — components & instances
8. **Phase 3** — variables
9. **Phase 4** — styles, boolean ops, JSX renderer

## Property Mapping Reference

| Figma Property | SceneNode Field | Type | Notes |
|---------------|-----------------|------|-------|
| `characters` | `text` | `string` | |
| `fontName` | `fontFamily` + `fontWeight` + `italic` | `{ family, style }` | Computed: `style` = "Bold Italic" etc. |
| `strokeWeight` | `strokes[0].weight` | `number` | Computed |
| `strokeAlign` | `strokes[0].align` | `string` | Computed |
| `primaryAxisAlignItems` | `primaryAxisAlign` | `string` | |
| `counterAxisAlignItems` | `counterAxisAlign` | `string` | |
| `layoutSizingHorizontal` | `primaryAxisSizing` or `counterAxisSizing` | `string` | Depends on `layoutMode` |
| `layoutSizingVertical` | (opposite of horizontal) | `string` | |
| `absoluteTransform` | computed from `x`, `y`, `rotation` | `Transform` | Read-only |
| `absoluteBoundingBox` | `getAbsoluteBounds(id)` | `Rect` | Read-only |
| All others | Same name | Same type | Direct passthrough |

## Open Questions

1. **Font loading**: `figma.loadFontAsync()` — should it be a no-op (we don't have font gating) or should we track loaded fonts?
   → **Decision: No-op that returns resolved Promise.** We don't gate text editing on font loading.

2. **Export in headless mode**: `node.exportAsync()` requires CanvasKit. Should eval load CanvasKit?
   → **Decision: Optional.** If CanvasKit is available (via `--with-canvaskit` flag or env), enable export. Otherwise, throw "Export requires CanvasKit" error.

3. **`figma.mixed` symbol**: Should we use the actual Figma symbol or our own?
   → **Decision: Our own `Symbol('mixed')`.** Exposed as `figma.mixed`.

4. **Undo**: `figma.commitUndo()` / `figma.triggerUndo()` — relevant in headless?
   → **Decision: No-op in CLI.** Undo only matters in the live editor. The AI tools can add undo support separately via EditorStore.

5. **Write format**: Should `--write` produce `.fig` (Kiwi binary) or also support `.json`?
   → **Decision: `.fig` only for now.** JSON export is a separate feature.
