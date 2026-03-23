## 1. Extract SVG parsing to shared module

- [x] 1.1 Create `packages/core/src/svg-import.ts`. Move from `packages/core/src/iconify.ts`: `attrValue`, `num`, `shapeToD`, `resolveAttr`, `extractPaths`, and the `PathInfo` interface. Export `extractPaths` and `PathInfo`. `iconify.ts` imports `{ extractPaths, type PathInfo }` from `'./svg-import'`.

- [x] 1.2 Add `parseSVGFile` to `packages/core/src/svg-import.ts`:
  ```ts
  export function parseSVGFile(svgText: string, targetSize?: number): IconData {
    // 1. Parse <svg> tag attributes
    const svgMatch = svgText.match(/<svg\b[^>]*>/)
    const svgTag = svgMatch?.[0] ?? ''
    const vb = attrValue(svgTag, 'viewBox')
    let minX = 0, minY = 0, vbW = 0, vbH = 0
    if (vb) {
      const parts = vb.split(/[\s,]+/).map(Number)
      ;[minX, minY, vbW, vbH] = parts
    }
    if (vbW <= 0) vbW = num(svgTag, 'width', 100)
    if (vbH <= 0) vbH = num(svgTag, 'height', 100)

    // 2. Strip <svg> wrapper to get body
    const body = svgText.replace(/<svg\b[^>]*>/, '').replace(/<\/svg\s*>/, '')

    // 3. Extract paths
    const pathInfos = extractPaths(body)
    if (pathInfos.length === 0) return { prefix: 'svg', name: 'imported', width: vbW, height: vbH, paths: [] }

    // 4. Scale to targetSize if provided
    const size = targetSize ?? Math.max(vbW, vbH)
    const sx = size / vbW
    const sy = size / vbH

    const paths = pathInfos.map((p) => {
      let d = p.d
      if (minX !== 0 || minY !== 0 || sx !== 1 || sy !== 1) {
        d = svgpath(d).translate(-minX, -minY).scale(sx, sy).round(2).toString()
      }
      return {
        vectorNetwork: parseSVGPath(d, p.fillRule),
        fill: p.fill,
        stroke: p.stroke,
        strokeWidth: p.strokeWidth * Math.min(sx, sy),
        strokeCap: p.strokeCap,
        strokeJoin: p.strokeJoin
      }
    })

    return {
      prefix: 'svg',
      name: 'imported',
      width: targetSize ?? vbW,
      height: targetSize ?? vbH,
      paths
    }
  }
  ```
  Import `svgpath` from `'svgpath'` and `{ parseSVGPath }` from `'./svg-path-parse'` and `type { IconData, IconPath }` from `'./iconify'`. Note: `IconData`/`IconPath` types are exported from iconify — keep them there, import into svg-import.

- [x] 1.3 Export `parseSVGFile` from `packages/core/src/index.ts` barrel alongside existing iconify exports.

- [x] 1.4 Add unit test `tests/engine/svg-import.test.ts`:
  - SVG with single `<path>` and viewBox → returns IconData with 1 path, correct dimensions
  - SVG with `<circle>` + `<rect>` → returns 2 paths
  - SVG without viewBox, with width/height → uses those
  - SVG with no shapes → returns empty paths array
  - SVG with viewBox offset (minX=10, minY=10) → paths translated correctly

## 2. Fix viewport center — export and use canvasViewportCenter

- [x] 2.1 Export `canvasViewportCenter` in store return object (it's already defined, just needs to be in the return).

- [x] 2.2 In `src/components/AssetItem.vue` — remove `viewportCenter()` function, use `store.canvasViewportCenter()` in `onDblClick`:
  ```ts
  function onDblClick() {
    const id = resolveInsertableId()
    if (!id) return
    const { x, y } = store.canvasViewportCenter()
    store.createInstanceFromComponent(id, x, y, store.state.currentPageId)
  }
  ```

- [x] 2.3 In `src/components/ImageAssetItem.vue` — update `placeAtCenter()`:
  ```ts
  function placeAtCenter() {
    const { x, y } = store.canvasViewportCenter()
    store.placeImageFromHash(hash, x, y)
  }
  ```

- [x] 2.4 In `src/stores/editor.ts` `pasteFromHTML` — replace `(-state.panX + window.innerWidth / 2) / state.zoom` fallback with `canvasViewportCenter()`:
  ```ts
  const center = canvasViewportCenter()
  const cx = cursorPos?.x ?? center.x
  const cy = cursorPos?.y ?? center.y
  ```

## 3. SVG drop from OS

- [x] 3.1 Add `placeSVGFile(svgText: string, x: number, y: number, name?: string)` to editor store:
  ```ts
  function placeSVGFile(svgText: string, x: number, y: number, name = 'SVG') {
    const iconData = parseSVGFile(svgText)
    if (iconData.paths.length === 0) return null
    const w = iconData.width
    const h = iconData.height
    const color: Color = { r: 0, g: 0, b: 0, a: 1 }
    const frame = createIconFromPaths(graph, iconData, name.replace(/\.svg$/i, ''), Math.max(w, h), color, state.currentPageId, {
      x: x - w / 2, y: y - h / 2, width: w, height: h
    })
    state.selectedIds = new Set([frame.id])
    const frameId = frame.id
    undo.push({
      label: 'Place SVG',
      forward: () => {
        // Re-parse and re-create (SVG text is immutable)
        const data = parseSVGFile(svgText)
        createIconFromPaths(graph, data, name, Math.max(w, h), color, state.currentPageId, {
          id: frameId, x: x - w / 2, y: y - h / 2, width: w, height: h
        })
        state.selectedIds = new Set([frameId])
      },
      inverse: () => {
        graph.deleteNode(frameId)
        state.selectedIds = new Set()
      }
    })
    requestRender()
    return frameId
  }
  ```
  Import `parseSVGFile` from `@open-pencil/core` and `createIconFromPaths` from `@open-pencil/core`. Export `placeSVGFile` in store return.

- [x] 3.2 In `src/composables/use-canvas-drop.ts`:
  - Add `const SVG_TYPE = 'image/svg+xml'`
  - Modify `ACCEPTED_TYPES` to include SVG_TYPE
  - In `drop` handler, after component and image asset checks, before `filterImageFiles`:
    ```ts
    // SVG files: parse as vector, not raster
    const allFiles = e.dataTransfer?.files
    if (allFiles) {
      const svgFiles: File[] = []
      const rasterFiles: File[] = []
      for (const file of allFiles) {
        if (file.type === SVG_TYPE || file.name.endsWith('.svg')) {
          svgFiles.push(file)
        } else if (ACCEPTED_TYPES.has(file.type)) {
          rasterFiles.push(file)
        }
      }
      const canvas = canvasRef.value
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const { x: cx, y: cy } = store.screenToCanvas(e.clientX - rect.left, e.clientY - rect.top)

      // Place SVG files as vector nodes
      for (const file of svgFiles) {
        const text = await file.text()
        store.placeSVGFile(text, cx, cy, file.name)
      }
      // Place raster files as images
      if (rasterFiles.length > 0) {
        void store.placeImageFiles(rasterFiles, cx, cy)
      }
      return
    }
    ```
    Note: the drop handler needs to become `async` for `file.text()`. Also use filename `.svg` extension as fallback detection besides MIME type.

## 4. Quality gates

- [x] 4.1 `bun run check` — zero errors
- [x] 4.2 `bun run format`
- [x] 4.3 `bun run test:unit` — all pass
- [x] 4.4 `bun run test:dupes` — under 3%
