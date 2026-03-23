## 1. SceneGraph — getComponentsGroupedByPage()

- [x] 1.1 Add method to `packages/core/src/scene-graph.ts` in the `SceneGraph` class, after `getInstances()`:
  ```ts
  getComponentsGroupedByPage(): Array<{ page: SceneNode; components: SceneNode[] }> {
    const result: Array<{ page: SceneNode; components: SceneNode[] }> = []
    for (const page of this.getPages()) {
      const components: SceneNode[] = []
      const stack = [...page.childIds]
      while (stack.length > 0) {
        const id = stack.pop()
        if (!id) continue
        const node = this.nodes.get(id)
        if (!node) continue
        if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
          components.push(node)
        } else if (node.type !== 'INSTANCE' && CONTAINER_TYPES.has(node.type)) {
          stack.push(...node.childIds)
        }
      }
      if (components.length > 0) result.push({ page, components })
    }
    return result
  }
  ```
  Key details:
  - Iterative stack, no `!` non-null assertions (guard with `if (!id) continue`)
  - Does NOT recurse into COMPONENT_SET (variants are accessed separately via `getChildren()` in the UI)
  - Does NOT recurse into INSTANCE nodes (their internal structure shouldn't appear in Assets)
  - DOES recurse into FRAME, GROUP, SECTION to find nested components

- [x] 1.2 Add unit tests in `tests/engine/scene-graph.test.ts` — new `describe('getComponentsGroupedByPage')` block:
  - Empty document (no components) → returns `[]`
  - One COMPONENT on default page → returns `[{ page, components: [comp] }]`
  - Components on two pages → two entries, correct page refs, correct components
  - COMPONENT inside a FRAME inside a page → found
  - COMPONENT_SET with 2 COMPONENT children → only the SET appears in result
  - INSTANCE node on page → excluded
  - Page with only RECTANGLEs → page omitted from results
  - COMPONENT inside an INSTANCE → NOT found (don't recurse into instances)

## 2. Editor store — state + focusNode + thumbnail + fix createInstance

- [x] 2.1 Add `leftPanelTab` to `state` in `src/stores/editor.ts` (after `enteredContainerId`):
  ```ts
  leftPanelTab: 'layers' as 'layers' | 'assets',
  ```

- [x] 2.2 Add `focusNode(nodeId: string)` function before `goToMainComponent()`:
  ```ts
  function focusNode(nodeId: string) {
    const node = graph.getNode(nodeId)
    if (!node) return
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
  Note: uses `window.innerWidth/Height` consistent with existing `zoomToBounds()`, `zoomTo100()`, and `zoomToSelection()` in this same store.

  Then refactor `goToMainComponent()` to use it:
  ```ts
  function goToMainComponent() {
    const node = selectedNode.value
    if (!node?.componentId) return
    const main = graph.getMainComponent(node.id)
    if (!main) return
    focusNode(main.id)
  }
  ```
  This eliminates the hardcoded `viewW = 800, viewH = 600`.

- [x] 2.3 Fix `createInstanceFromComponent` — preserve existing default behavior, add explicit override:
  ```ts
  function createInstanceFromComponent(
    componentId: string, x?: number, y?: number, targetPageId?: string
  ) {
    const component = graph.getNode(componentId)
    if (component?.type !== 'COMPONENT') return null
    // Original behavior: sibling of component. Override: target page root.
    const parentId = targetPageId ?? component.parentId ?? state.currentPageId
    const instance = graph.createInstance(componentId, parentId, {
      x: x ?? component.x + component.width + 40,
      y: y ?? component.y
    })
    if (!instance) return null
    const instanceId = instance.id
    state.selectedIds = new Set([instanceId])
    undo.push({
      label: 'Create instance',
      forward: () => {
        graph.createInstance(componentId, parentId, { ...instance })
        state.selectedIds = new Set([instanceId])
      },
      inverse: () => {
        graph.deleteNode(instanceId)
        state.selectedIds = new Set([componentId])
      }
    })
    return instanceId
  }
  ```
  When `targetPageId` is omitted → uses `component.parentId` (existing behavior, E2E safe).
  When `targetPageId` is provided (from drag-drop) → instance goes to that page.

- [x] 2.4 Add `renderComponentThumbnail(nodeId: string, size = 48): string | null`:
  ```ts
  function renderComponentThumbnail(nodeId: string, size = 48): string | null {
    if (!_ck || !_renderer) return null
    const node = graph.getNode(nodeId)
    if (!node || (node.width <= 0 && node.height <= 0)) return null
    let pageNode: SceneNode | undefined = node
    while (pageNode && pageNode.type !== 'CANVAS') {
      pageNode = pageNode.parentId ? graph.getNode(pageNode.parentId) : undefined
    }
    if (!pageNode) return null
    const maxDim = Math.max(node.width, node.height, 1)
    const scale = Math.min(size / maxDim, 2)
    const bytes = renderNodesToImage(_ck, _renderer, graph, pageNode.id, [nodeId], {
      scale, format: 'PNG' as ExportFormat
    })
    if (!bytes) return null
    return URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'image/png' }))
  }
  ```
  Scale: `size / max(width, height)` fits the component into a `size` box, capped at 2× for tiny components. `renderNodesToImage` computes the output dimensions as `contentW * scale × contentH * scale`, so a 200×100 component at `scale = 48/200 = 0.24` produces a 48×24 image. This is correct — we use `object-contain` in the `<img>` CSS.

- [x] 2.5 Export in store return object: add `focusNode`, `renderComponentThumbnail` next to `goToMainComponent`, `createInstanceFromComponent`, `leftPanelTab` is already on state

## 3. Left panel — Layers/Assets tab switcher

- [x] 3.1 Refactor `src/components/LayersPanel.vue`:
  Add imports: `TabsContent, TabsList, TabsRoot, TabsTrigger` from `reka-ui`, `AssetsPanel` from `./AssetsPanel.vue`, `useEditorStore`

  In the bottom `<SplitterPanel>`, replace the static header + LayerTree with:
  ```html
  <TabsRoot v-model="store.state.leftPanelTab" class="flex min-h-0 flex-1 flex-col">
    <TabsList class="flex shrink-0 items-center gap-2 px-3 py-2">
      <TabsTrigger
        value="layers"
        class="text-[11px] tracking-wider uppercase text-muted hover:text-surface
               data-[state=active]:font-semibold data-[state=active]:text-surface"
      >
        Layers
      </TabsTrigger>
      <TabsTrigger
        value="assets"
        class="text-[11px] tracking-wider uppercase text-muted hover:text-surface
               data-[state=active]:font-semibold data-[state=active]:text-surface"
      >
        Assets
      </TabsTrigger>
    </TabsList>
    <TabsContent value="layers" class="flex min-h-0 flex-1 flex-col"
      :force-mount="true" :hidden="store.state.leftPanelTab !== 'layers'">
      <LayerTree data-test-id="layers-tree" />
    </TabsContent>
    <TabsContent value="assets" class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AssetsPanel />
    </TabsContent>
  </TabsRoot>
  ```
  `force-mount` on Layers preserves tree expand/collapse state when switching — same pattern as `PropertiesPanel.vue` lines 56-78.

## 4. Thumbnail composable

- [x] 4.1 Create `src/composables/use-component-thumbnails.ts`:
  ```ts
  import { watchDebounced } from '@vueuse/core'
  import { ref, onScopeDispose, type Ref } from 'vue'
  import type { EditorStore } from '@/stores/editor'

  const BATCH_SIZE = 10

  export function useComponentThumbnails(
    store: EditorStore,
    componentIds: Ref<string[]>
  ) {
    const thumbnails = ref(new Map<string, string>())
    let pending = false

    function refresh() {
      if (pending) return
      pending = true

      const oldMap = thumbnails.value
      const currentIds = componentIds.value
      const newMap = new Map<string, string>()

      // Keep existing URLs for IDs that still exist (avoid re-render flicker)
      // Revoke URLs for removed IDs
      for (const [id, url] of oldMap) {
        if (currentIds.includes(id)) {
          newMap.set(id, url)
        } else {
          URL.revokeObjectURL(url)
        }
      }

      // Find IDs that need (re-)rendering
      const toRender = currentIds.filter(id => !newMap.has(id))
      if (toRender.length === 0) {
        thumbnails.value = newMap
        pending = false
        return
      }

      // Batch render to avoid blocking main thread
      let i = 0
      function renderBatch() {
        const end = Math.min(i + BATCH_SIZE, toRender.length)
        for (; i < end; i++) {
          const id = toRender[i]
          const url = store.renderComponentThumbnail(id)
          if (url) newMap.set(id, url)
        }
        if (i < toRender.length) {
          requestAnimationFrame(renderBatch)
        } else {
          thumbnails.value = new Map(newMap)
          pending = false
        }
      }
      renderBatch()
    }

    // Full re-render on scene changes (component edits)
    function fullRefresh() {
      // Revoke all existing, then re-render everything
      for (const url of thumbnails.value.values()) URL.revokeObjectURL(url)
      thumbnails.value = new Map()
      pending = false
      refresh()
    }

    // Initial render (just new IDs)
    watchDebounced(componentIds, refresh, { debounce: 100, immediate: true })
    // Scene changes: full re-render with longer debounce
    watchDebounced(() => store.state.sceneVersion, fullRefresh, { debounce: 500 })

    onScopeDispose(() => {
      for (const url of thumbnails.value.values()) URL.revokeObjectURL(url)
    })

    return thumbnails
  }
  ```
  Key fixes from review:
  - **Batched rendering** (10 per rAF frame) to avoid blocking main thread
  - **Two separate watchers**: fast initial render when component list changes, slow full re-render on scene edits
  - **Keeps existing URLs** when component list is unchanged — avoids flicker
  - `pending` flag prevents concurrent refresh storms
  - Proper cleanup on dispose

## 5. AssetsPanel component

- [x] 5.1 Create `src/components/AssetsPanel.vue`:
  Script setup:
  - Import `computed, ref` from vue, `CollapsibleContent, CollapsibleRoot, CollapsibleTrigger` from reka-ui, store, thumbnails composable, AssetItem
  - `const store = useEditorStore()`
  - `const query = ref('')`
  - `const allGroups` computed: `void store.state.sceneVersion; return store.graph.getComponentsGroupedByPage()`
  - `const allComponentIds` computed: flatMap component IDs from allGroups. For COMPONENT_SETs, include both the set ID and its COMPONENT children IDs (for thumbnail rendering)
  - `const thumbnails = useComponentThumbnails(store, allComponentIds)`
  - `const filteredGroups` computed: if query is empty → return allGroups. Else for each group, filter components: COMPONENT matches if `name.toLowerCase().includes(q)`. COMPONENT_SET matches if its name matches OR any child COMPONENT name matches (via `store.graph.getChildren(set.id).filter(c => c.type === 'COMPONENT' && c.name.toLowerCase().includes(q))`). Omit empty groups.

  Template structure:
  ```
  <div class="flex min-h-0 flex-1 flex-col">
    <!-- Search -->
    <div class="flex items-center gap-1.5 border-b border-border px-3 py-1.5">
      <icon-lucide-search class="size-3 text-muted" />
      <input v-model="query" placeholder="Search components..."
        class="min-w-0 flex-1 bg-transparent text-xs text-surface placeholder:text-muted outline-none" />
    </div>

    <!-- Empty: no components -->
    <div v-if="allGroups.length === 0" class="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
      <icon-lucide-component class="size-8 text-muted" />
      <p class="text-xs text-muted">No components</p>
      <p class="text-[10px] text-muted">Select a frame and press ⌥⌘K</p>
    </div>

    <!-- Empty: search no results -->
    <div v-else-if="filteredGroups.length === 0" class="flex flex-1 items-center justify-center px-4">
      <p class="text-xs text-muted">No results for "{{ query }}"</p>
    </div>

    <!-- Component list -->
    <div v-else class="scrollbar-thin flex-1 overflow-y-auto px-1 pb-1">
      <CollapsibleRoot v-for="group in filteredGroups" :key="group.page.id" default-open>
        <CollapsibleTrigger class="flex w-full items-center gap-1.5 px-2 py-1 text-[11px] tracking-wider text-muted uppercase hover:text-surface">
          <icon-lucide-chevron-down class="size-3 transition-transform [[data-state=closed]>&]:rotate-[-90deg]" />
          {{ group.page.name }}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <template v-for="comp in group.components" :key="comp.id">
            <!-- COMPONENT_SET: expandable with variants -->
            <CollapsibleRoot v-if="comp.type === 'COMPONENT_SET'" default-open>
              <AssetItem :node="comp" :thumbnail-url="thumbnails.get(comp.id)" is-set />
              <CollapsibleContent>
                <AssetItem
                  v-for="variant in store.graph.getChildren(comp.id).filter(c => c.type === 'COMPONENT')"
                  :key="variant.id" :node="variant"
                  :thumbnail-url="thumbnails.get(variant.id)" indented />
              </CollapsibleContent>
            </CollapsibleRoot>
            <!-- Standalone COMPONENT -->
            <AssetItem v-else :node="comp" :thumbnail-url="thumbnails.get(comp.id)" />
          </template>
        </CollapsibleContent>
      </CollapsibleRoot>
    </div>
  </div>
  ```

## 6. AssetItem component

- [x] 6.1 Create `src/components/AssetItem.vue`:
  Props: `node: SceneNode`, `thumbnailUrl?: string`, `indented?: boolean`, `isSet?: boolean`

  Script setup:
  ```ts
  import { computed } from 'vue'
  import { ContextMenuRoot, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from 'reka-ui'
  import { useEditorStore } from '@/stores/editor'

  const props = defineProps<{
    node: import('@open-pencil/core').SceneNode
    thumbnailUrl?: string
    indented?: boolean
    isSet?: boolean
  }>()

  const store = useEditorStore()

  const instanceCount = computed(() => {
    void store.state.sceneVersion
    return store.graph.instanceIndex.get(props.node.id)?.size ?? 0
  })

  function viewportCenter() {
    return {
      x: (-store.state.panX + window.innerWidth / 2) / store.state.zoom,
      y: (-store.state.panY + window.innerHeight / 2) / store.state.zoom
    }
  }

  function onDragStart(e: DragEvent) {
    if (!e.dataTransfer) return
    const id = props.node.type === 'COMPONENT_SET'
      ? store.graph.getChildren(props.node.id).find(c => c.type === 'COMPONENT')?.id ?? props.node.id
      : props.node.id
    e.dataTransfer.setData('application/x-openpencil-component', id)
    e.dataTransfer.effectAllowed = 'copy'
  }

  function onDblClick() {
    const id = props.node.type === 'COMPONENT_SET'
      ? store.graph.getChildren(props.node.id).find(c => c.type === 'COMPONENT')?.id
      : props.node.id
    if (!id) return
    const { x, y } = viewportCenter()
    store.createInstanceFromComponent(id, x, y, store.state.currentPageId)
  }

  function insertInstance() { onDblClick() }

  function goToComponent() { store.focusNode(props.node.id) }
  ```

  Template:
  ```html
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <div
        :class="['flex items-center gap-2 rounded px-2 py-1 cursor-pointer hover:bg-hover',
                  indented ? 'pl-6' : '']"
        :title="node.description || node.name"
        :draggable="true"
        @dragstart="onDragStart"
        @dblclick="onDblClick"
      >
        <div class="size-8 shrink-0 overflow-hidden rounded border border-border bg-canvas">
          <img v-if="thumbnailUrl" :src="thumbnailUrl" class="size-full object-contain" alt="" />
          <div v-else class="flex size-full items-center justify-center">
            <icon-lucide-component class="size-3.5 text-muted" />
          </div>
        </div>
        <icon-lucide-diamond v-if="node.type === 'COMPONENT'" class="size-3 shrink-0 text-[#9747ff]" />
        <icon-lucide-grid-2x2 v-else class="size-3 shrink-0 text-[#9747ff]" />
        <span class="min-w-0 flex-1 truncate text-xs text-surface">{{ node.name }}</span>
        <icon-lucide-chevron-down v-if="isSet"
          class="size-3 shrink-0 text-muted transition-transform [[data-state=closed]>&]:rotate-[-90deg]" />
        <span v-if="instanceCount > 0" class="shrink-0 text-[10px] text-muted">
          {{ instanceCount }}×
        </span>
      </div>
    </ContextMenuTrigger>
    <ContextMenuContent class="min-w-40 rounded-lg border border-border bg-panel p-1 shadow-lg">
      <ContextMenuItem class="cursor-pointer rounded px-2 py-1 text-xs text-surface hover:bg-hover"
        @select="insertInstance">
        Insert instance
      </ContextMenuItem>
      <ContextMenuItem class="cursor-pointer rounded px-2 py-1 text-xs text-surface hover:bg-hover"
        @select="goToComponent">
        Go to component
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenuRoot>
  ```

## 7. Drag-and-drop — extend use-canvas-drop

- [x] 7.1 In `src/composables/use-canvas-drop.ts`:

  Add helper:
  ```ts
  function hasComponentData(e: DragEvent): boolean {
    return e.dataTransfer?.types.includes('application/x-openpencil-component') ?? false
  }
  ```

  Modify `dragover` listener — component check FIRST:
  ```ts
  useEventListener(canvasRef, 'dragover', (e: DragEvent) => {
    if (hasComponentData(e)) {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
      isDraggingOver.value = true
      return
    }
    if (!hasImageFiles(e)) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    isDraggingOver.value = true
  })
  ```

  Modify `dragenter` — same priority:
  ```ts
  useEventListener(canvasRef, 'dragenter', (e: DragEvent) => {
    if (hasComponentData(e) || hasImageFiles(e)) {
      e.preventDefault()
      isDraggingOver.value = true
    }
  })
  ```

  Modify `drop` — component handling FIRST:
  ```ts
  useEventListener(canvasRef, 'drop', (e: DragEvent) => {
    e.preventDefault()
    isDraggingOver.value = false

    const componentId = e.dataTransfer?.getData('application/x-openpencil-component')
    if (componentId) {
      const canvas = canvasRef.value
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const { x, y } = store.screenToCanvas(e.clientX - rect.left, e.clientY - rect.top)
      store.createInstanceFromComponent(componentId, x, y, store.state.currentPageId)
      return
    }

    const files = filterImageFiles(e.dataTransfer?.files ?? null)
    if (!files.length) return
    // ... existing image drop logic unchanged
  })
  ```
  The `store.state.currentPageId` is passed as `targetPageId` so the instance lands on the current page, not on the component's page.

## 8. MCP / AI system prompt

- [x] 8.1 In `src/constants.ts`, update the key tools line in `ACP_DESIGN_CONTEXT`:
  From: `Key tools: render (JSX to design), create_shape, set_fill, set_layout, find_nodes, get_page_tree, export_image.`
  To: `Key tools: render (JSX to design), create_shape, set_fill, set_layout, find_nodes, get_page_tree, export_image, get_components (list reusable components), create_instance (insert component instance).`

## 9. Documentation

- [x] 9.1 Add to `CHANGELOG.md` Unreleased section:
  ```md
  ### Added
  - Assets tab in left panel — browse, search, and insert components with thumbnail previews
  ```

## 10. Quality gates

- [x] 10.1 `bun run check` — zero lint/type errors
- [x] 10.2 `bun run format` — format all modified files
- [x] 10.3 `bun run test:unit` — all tests pass (3 pre-existing failures on master, not caused by this change)
- [x] 10.4 `bun run test:dupes` — 1.3% duplication (under 3%)
