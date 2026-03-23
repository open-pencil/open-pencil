## 1. SceneGraph — getImageUsages()

- [x] 1.1 Add method to `packages/core/src/scene-graph.ts` after `getComponentsGroupedByPage()`. Single pass over all nodes (O(n)):
  ```ts
  getImageUsages(): Map<string, { hash: string; nodeIds: string[]; names: string[] }> {
    const usages = new Map<string, { hash: string; nodeIds: string[]; names: string[] }>()
    for (const hash of this.images.keys()) {
      usages.set(hash, { hash, nodeIds: [], names: [] })
    }
    for (const node of this.nodes.values()) {
      if (node.type === 'CANVAS') continue
      for (const fill of node.fills) {
        if (fill.type !== 'IMAGE' || !fill.imageHash) continue
        const entry = usages.get(fill.imageHash)
        if (entry && !entry.nodeIds.includes(node.id)) {
          entry.nodeIds.push(node.id)
          entry.names.push(node.name)
        }
      }
    }
    return usages
  }
  ```
  No `!` assertions. Single pass O(n). Only checks fills (strokes don't have imageHash in the schema).

- [x] 1.2 Unit tests in `tests/engine/scene-graph.test.ts` — `describe('getImageUsages')`:
  - No images → empty Map
  - One image used by one node → 1 entry, 1 nodeId
  - One image used by 3 nodes → 1 entry, 3 nodeIds and names
  - Image stored but not referenced → entry with empty nodeIds
  - Two different images → two separate entries
  - Node with SOLID + IMAGE fill → only IMAGE fill counted

## 2. MIME detection + image blob URL helper

- [x] 2.1 Add `detectImageMime(bytes: Uint8Array): string` as a private function in `src/stores/editor.ts` (near `decodeImageDimensions`):
  ```ts
  function detectImageMime(bytes: Uint8Array): string {
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png'
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) return 'image/jpeg'
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45) return 'image/webp'
    return 'image/png'
  }
  ```
  No existing utility in codebase — checked `rg "image/png" src/` and only found format-to-mime switch, not bytes-to-mime.

- [x] 2.2 Add `imageBlobUrl(hash: string): string | null` to editor store with internal cache:
  ```ts
  const _imageBlobCache = new Map<string, string>()

  function imageBlobUrl(hash: string): string | null {
    const cached = _imageBlobCache.get(hash)
    if (cached) return cached
    const bytes = graph.images.get(hash)
    if (!bytes) return null
    const mime = detectImageMime(bytes)
    const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: mime }))
    _imageBlobCache.set(hash, url)
    return url
  }
  ```
  Cache keyed by hash — immutable (same hash = same bytes). URLs persist for lifetime of the store (images don't change once stored). On file open (`openFigFile`), clear cache and revoke all old URLs.

- [x] 2.3 Add cleanup in `openFigFile` — revoke cached blob URLs before loading new document:
  ```ts
  for (const url of _imageBlobCache.values()) URL.revokeObjectURL(url)
  _imageBlobCache.clear()
  ```

## 3. Store — placeImageFromHash

- [x] 3.1 Add `placeImageFromHash(hash: string, x: number, y: number): string | null` reusing existing `decodeImageDimensions`:
  ```ts
  function placeImageFromHash(hash: string, x: number, y: number): string | null {
    const bytes = graph.images.get(hash)
    if (!bytes) return null
    const dims = decodeImageDimensions(bytes)
    const w = dims?.w ?? 200
    const h = dims?.h ?? 200
    const fill: Fill = {
      type: 'IMAGE', imageHash: hash, imageScaleMode: 'FILL' as ImageScaleMode,
      color: { r: 0, g: 0, b: 0, a: 0 }, opacity: 1, visible: true
    }
    const node = graph.createNode('RECTANGLE', state.currentPageId, {
      name: 'Image', x: x - w / 2, y: y - h / 2, width: w, height: h, fills: [fill]
    })
    state.selectedIds = new Set([node.id])
    const nodeId = node.id
    const snapshot = { ...node }
    undo.push({
      label: 'Place image',
      forward: () => {
        graph.images.set(hash, bytes)
        graph.createNode('RECTANGLE', state.currentPageId, snapshot)
        state.selectedIds = new Set([nodeId])
      },
      inverse: () => {
        graph.deleteNode(nodeId)
        state.selectedIds = new Set()
      }
    })
    requestRender()
    return nodeId
  }
  ```
  Centers image at drop point (x - w/2, y - h/2). Uses existing `decodeImageDimensions` for size. Undo ensures image bytes are re-stored on redo.

- [x] 3.2 Export `placeImageFromHash`, `imageBlobUrl` in store return object.

## 4. ImageAssetItem component

- [x] 4.1 Create `src/components/ImageAssetItem.vue`:
  Props (destructured): `hash: string`, `names: string[]`, `nodeIds: string[]`, `thumbnailUrl: string`
  
  Script:
  - `const store = useEditorStore()`
  - `displayName` computed: first 2 names joined by ", " + "+N" if more. If no names, show truncated hash.
  - `usageCount` = `nodeIds.length`
  - Click handler: filter nodeIds to those on current page, set selectedIds
  - DragStart: `e.dataTransfer.setData('application/x-openpencil-image-asset', hash)`
  - Context menu: "Select all uses" (same as click), "Place copy" (viewport center insert)

  Template: 32×32 thumbnail (img with object-cover), display name (truncated), usage count badge, context menu (ContextMenuRoot).

## 5. AssetsPanel — restructure with Components + Images sections

- [x] 5.1 Modify `src/components/AssetsPanel.vue`:
  - Add `imageUsages` computed: `void store.state.sceneVersion; return store.graph.getImageUsages()`
  - Add `imageList` computed: convert Map to array, compute blob URLs via `store.imageBlobUrl(hash)`
  - Add `filteredImages` computed: if query active, filter by names matching query
  - Add `totalComponents` computed: sum of all component counts
  - Update search placeholder to "Search assets..."
  - Update empty state: when `allGroups.length === 0 && imageUsages.size === 0` → "No assets" (not "No components")
  - Wrap existing components list in collapsible "Components (N)" section (only shown if N > 0)
  - Add collapsible "Images (N)" section below (only shown if N > 0)
  - When search active and both sections empty → "No results for '...'"

## 6. Canvas drop — image asset MIME

- [x] 6.1 In `src/composables/use-canvas-drop.ts`:
  Add constant: `const IMAGE_ASSET_MIME = 'application/x-openpencil-image-asset'`
  Add `hasImageAssetData(e)` helper.
  In dragover: check image asset AFTER component, BEFORE file images.
  In dragenter: add to combined check.
  In drop: after component check, before file check:
  ```ts
  const imageHash = e.dataTransfer?.getData(IMAGE_ASSET_MIME)
  if (imageHash) {
    const canvas = canvasRef.value
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const { x, y } = store.screenToCanvas(e.clientX - rect.left, e.clientY - rect.top)
    store.placeImageFromHash(imageHash, x, y)
    return
  }
  ```

## 7. Quality gates

- [x] 7.1 `bun run check` — zero errors
- [x] 7.2 `bun run format`
- [x] 7.3 `bun run test:unit` — 39/39 pass
- [x] 7.4 `bun run test:dupes` — 1.31%
