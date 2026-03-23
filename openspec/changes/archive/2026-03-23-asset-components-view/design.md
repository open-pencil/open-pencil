## Context

The left sidebar (`LayersPanel.vue`) has a fixed layout: PagesPanel (top SplitterPanel) + "Layers" header + LayerTree (bottom SplitterPanel), managed by reka-ui SplitterGroup. There's no tab switching — the bottom section is always the layer tree.

The scene graph has full component infrastructure: `COMPONENT`, `COMPONENT_SET`, `INSTANCE` node types. `instanceIndex` maps componentId → Set of instance IDs. `getInstances(componentId)` returns all instances. `createInstance(componentId, parentId, overrides)` handles deep-cloning with componentId mapping. COMPONENT_SET is a parent container — its direct children are COMPONENT nodes (variants).

For rendering thumbnails, `renderNodesToImage()` in `render-image.ts` creates an offscreen CanvasKit surface, renders nodes, encodes to PNG. It needs `CanvasKit`, `SkiaRenderer`, `SceneGraph`, `pageId`, `nodeIds`, and `{ scale, format }`.

The store has `_ck` (CanvasKit) and `_renderer` (SkiaRenderer) as private vars. `renderer` is exposed as a getter but `_ck` is not. `renderExportImage()` uses both internally. We need to either expose `_ck` or add a store-level thumbnail method.

`createInstanceFromComponent(componentId, x?, y?)` exists in the store. BUG: it uses `component.parentId ?? state.currentPageId` as the parent. When dragging from Assets to canvas, if the component is on Page 2 but we're viewing Page 1, the instance gets created on Page 2 (component's parent page), invisible to the user. Fix: add an explicit `targetPageId` parameter.

`goToMainComponent()` navigates to a component but uses hardcoded `viewW = 800, viewH = 600` instead of `window.innerWidth/Height`. Other methods (`zoomToBounds`, `zoomTo100`) correctly use `window.innerWidth/Height`.

## Goals / Non-Goals

**Goals:**
- Layers/Assets tab switcher in left panel bottom section
- Component list grouped by page with collapsible sections
- COMPONENT_SET expands to show variant children (individual COMPONENTs inside)
- Each item: 48×48 thumbnail, name (truncated), type icon, instance count badge, description in title attribute
- Full-text search by name across all pages
- Drag from panel → drop on canvas → INSTANCE at drop position
- Double-click item → INSTANCE at viewport center
- Right-click context menu: "Go to component", "Insert instance"
- `focusNode(nodeId)` store helper for page-switching + viewport centering
- MCP system prompt mentions component discovery tools

**Non-Goals:**
- Remote/shared component libraries (requires backend)
- Component documentation editing in the panel
- Component properties panel (property definitions, boolean/text/instance-swap props)
- Thumbnail caching to IndexedDB
- Custom drag ghost image
- Keyboard shortcut for tab switching (future)

## Decisions

### 1. Tab switcher — reka-ui TabsRoot in bottom SplitterPanel

**What changes:** In `LayersPanel.vue`, the bottom SplitterPanel currently has:
```html
<header>Layers</header>
<LayerTree />
```
Replace with:
```html
<TabsRoot v-model="store.state.leftPanelTab">
  <TabsList> Layers | Assets </TabsList>
  <TabsContent value="layers"><LayerTree /></TabsContent>
  <TabsContent value="assets"><AssetsPanel /></TabsContent>
</TabsRoot>
```

Style: TabsTrigger with `text-[11px] tracking-wider uppercase` matching current header. Active state via `data-[state=active]:text-surface data-[state=active]:font-semibold`, inactive `text-muted`. No background change — just text weight/color, matching PropertiesPanel tab style.

### 2. Component enumeration — SceneGraph.getComponentsGroupedByPage()

**Method signature:**
```ts
getComponentsGroupedByPage(): Array<{ page: SceneNode; components: SceneNode[] }>
```

**Algorithm:**
```
for each page in getPages():
  components = []
  stack = [...page.childIds]
  while stack not empty:
    id = stack.pop()
    node = nodes.get(id)
    if node.type === 'COMPONENT':
      components.push(node)
    elif node.type === 'COMPONENT_SET':
      components.push(node)
      // DON'T recurse into COMPONENT_SET children — those are variants, shown via expansion
    elif CONTAINER_TYPES.has(node.type):
      stack.push(...node.childIds)  // recurse into frames/groups/sections
  if components.length > 0:
    result.push({ page, components })
```

Key: we DON'T recurse into COMPONENT_SET children at the top level — those COMPONENT children (variants) are shown when the set is expanded in the UI. We DO recurse into frames, groups, sections to find components nested inside them.

### 3. COMPONENT_SET variant expansion

In `AssetsPanel.vue`, when rendering a COMPONENT_SET item, wrap it in a reka-ui `CollapsibleRoot`. The trigger shows the set name + grid icon. The content lists its direct COMPONENT children as individual AssetItem rows (indented). Each variant is individually draggable/insertable.

**Data flow:**
```
group.components = [ButtonSet(COMPONENT_SET), Card(COMPONENT)]
→ ButtonSet expands to show: Button/Primary(COMPONENT), Button/Secondary(COMPONENT)
→ Card is a standalone COMPONENT
```

Variant children come from `graph.getChildren(componentSet.id).filter(c => c.type === 'COMPONENT')`.

### 4. Thumbnails — store-level renderComponentThumbnail()

**Why store-level, not composable:** `_ck` (CanvasKit instance) is private to the store. Rather than expose it, add:
```ts
function renderComponentThumbnail(nodeId: string, size = 48): string | null {
  if (!_ck || !_renderer) return null
  const node = graph.getNode(nodeId)
  if (!node) return null
  // Find which page this component is on
  const pageId = findPageId(graph, nodeId)
  if (!pageId) return null
  const bytes = renderNodesToImage(_ck, _renderer, graph, pageId, [nodeId], { scale: 1, format: 'PNG' })
  if (!bytes) return null
  const blob = new Blob([bytes], { type: 'image/png' })
  return URL.createObjectURL(blob)
}
```

**Composable `use-component-thumbnails`** calls this store method and manages the reactive Map + blob URL lifecycle:
- Input: computed list of component IDs
- Output: reactive `Map<string, string>` (nodeId → blob URL)
- Watch `sceneVersion` with 500ms `watchDebounced` from `@vueuse/core`
- On update: diff old vs new IDs, revoke removed blob URLs, render only new/changed ones
- Cleanup on `onScopeDispose`: revoke all blob URLs

### 5. Instance count — instanceIndex lookup

Each AssetItem shows instance count badge: `graph.instanceIndex.get(node.id)?.size ?? 0`. The `instanceIndex` is already maintained by createNode/updateNode/deleteNode. No extra tracking needed. Badge shows as dim text like "3×" next to the name.

### 6. Drag-and-drop — extend use-canvas-drop

**Priority order in event handlers:**
1. Check `dataTransfer.types.includes('application/x-openpencil-component')` FIRST
2. Fall through to `hasImageFiles(e)` check

**dragover handler extension:**
```ts
if (e.dataTransfer?.types.includes('application/x-openpencil-component')) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  isDraggingOver.value = true
  return  // don't fall through to image check
}
```

**drop handler extension:**
```ts
const componentId = e.dataTransfer?.getData('application/x-openpencil-component')
if (componentId) {
  e.preventDefault()
  isDraggingOver.value = false
  const rect = canvas.getBoundingClientRect()
  const { x, y } = store.screenToCanvas(e.clientX - rect.left, e.clientY - rect.top)
  store.createInstanceFromComponent(componentId, x, y, state.currentPageId)
  return
}
```

### 7. Fix createInstanceFromComponent — explicit targetPageId

**Current (broken):**
```ts
const parentId = component.parentId ?? state.currentPageId
```

**Fixed:**
```ts
function createInstanceFromComponent(componentId: string, x?: number, y?: number, targetPageId?: string) {
  ...
  const parentId = targetPageId ?? state.currentPageId
  ...
}
```

When called from context menu / keyboard (no target page), defaults to current page.
When called from drag-drop, explicitly passes `state.currentPageId`.

### 8. focusNode — generalized viewport navigation

```ts
function focusNode(nodeId: string) {
  const node = graph.getNode(nodeId)
  if (!node) return
  // Walk up to find page
  let current: SceneNode | undefined = node
  while (current && current.type !== 'CANVAS') {
    current = current.parentId ? graph.getNode(current.parentId) : undefined
  }
  if (current && current.id !== state.currentPageId) {
    void switchPage(current.id)
  }
  state.selectedIds = new Set([nodeId])
  const abs = graph.getAbsolutePosition(nodeId)
  const viewW = window.innerWidth
  const viewH = window.innerHeight
  state.panX = viewW / 2 - (abs.x + node.width / 2) * state.zoom
  state.panY = viewH / 2 - (abs.y + node.height / 2) * state.zoom
  requestRender()
}
```

Then refactor `goToMainComponent` to use `focusNode`:
```ts
function goToMainComponent() {
  const node = selectedNode.value
  if (!node?.componentId) return
  const main = graph.getMainComponent(node.id)
  if (!main) return
  focusNode(main.id)
}
```

### 9. AssetItem context menu

Use reka-ui `ContextMenuRoot/ContextMenuTrigger/ContextMenuContent/ContextMenuItem` (already used in `CanvasContextMenu.vue`). Two items:
- "Insert instance" → `createInstanceFromComponent(node.id, cx, cy)` at viewport center
- "Go to component" → `focusNode(node.id)`

### 10. Component description

SceneNode already has a `description: string` field (default `''`). Show as `title` attribute on the AssetItem root div — native browser tooltip on hover. No custom tooltip component needed for v1.

## Risks / Trade-offs

**[Thumbnail rendering blocks main thread]** → `renderNodesToImage` is synchronous. For 50 components at 48×48, each render is ~1-2ms = ~100ms total. Acceptable with 500ms debounce. If it becomes noticeable, can move to `requestIdleCallback` batching later.

**[Blob URL memory]** → Each thumbnail is ~1-5KB PNG. 100 components = ~500KB. Blob URLs are revoked on re-render and on composable dispose. Acceptable.

**[Component list O(n) scan]** → `getComponentsGroupedByPage()` walks all nodes. For a 10K node document, this is ~1ms. Cached by Vue computed until sceneVersion changes. Fine.

**[COMPONENT_SET expansion fetches children every render]** → `graph.getChildren(setId)` is a map lookup + filter. Negligible cost.
