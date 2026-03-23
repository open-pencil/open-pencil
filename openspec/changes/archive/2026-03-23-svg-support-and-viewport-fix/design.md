## Context

**Viewport center:** `canvasViewportCenter()` was just added to the store but not exported. It queries `[data-test-id="canvas-element"]` for the canvas bounds, falls back to `window.innerWidth/Height`. Uses `screenToCanvas(rect.width/2, rect.height/2)`. The canvas element is the WebGL CanvasKit surface that fills the center panel between the two sidebars.

**SVG pipeline:** The existing code has:
- `extractPaths(svgBody: string): PathInfo[]` — regex-parses SVG body for path/circle/ellipse/rect/line/polygon/polyline, extracts `d`, fill, stroke attributes. Handles group-level attributes.
- `parseSVGPath(d: string): VectorNetwork` — converts SVG path `d` attribute to scene graph VectorNetwork using `svgpath` library.
- `createIconFromPaths(graph, iconData, name, size, color, parentId)` — creates FRAME with VECTOR children from parsed paths.

This pipeline is used exclusively for Iconify icons. To support arbitrary SVG files, we need to expose `extractPaths` and create a higher-level `parseSVGFile()` that handles viewBox parsing and coordinate scaling.

**Image drop:** `use-canvas-drop.ts` accepts PNG/JPEG/WEBP/GIF/AVIF via `ACCEPTED_TYPES` Set. SVG (`image/svg+xml`) is absent. SVG should be handled differently from raster images — instead of storing as raw bytes with an IMAGE fill, SVG should be parsed into vector nodes.

## Goals / Non-Goals

**Goals:**
- Export and use `canvasViewportCenter()` everywhere items are inserted at viewport center
- Accept SVG files in OS drag-and-drop and parse to FRAME+VECTOR scene nodes
- Reuse existing `extractPaths` + `parseSVGPath` + `createIconFromPaths` pipeline
- SVG files stored in `graph.images` for round-trip (raw SVG text as bytes) and show in Assets

**Non-Goals:**
- Full SVG 2.0 spec compliance (gradients, filters, text, CSS styles, animations)
- SVG paste from clipboard (future — needs clipboard API changes)
- Editing SVG paths in-place (pen tool handles this separately)

## Decisions

### 1. Extract `extractPaths` and `parseSVGFile` to `packages/core/src/svg-import.ts`

New file. Re-exports `extractPaths` from iconify.ts and adds:
```ts
export function parseSVGFile(svgText: string, targetSize?: number): IconData
```
Parses full SVG (with `<svg>` wrapper), extracts viewBox/width/height, normalizes to `extractPaths` pipeline.

`iconify.ts` imports from `svg-import.ts` instead of inlining `extractPaths`.

### 2. Store: `placeSVGFile(svgText, x, y, name)` 

Calls `parseSVGFile()` → `createIconFromPaths()`. Adds undo. Also stores raw SVG bytes in `graph.images` for round-trip and Assets panel display.

### 3. Canvas drop: SVG files read as text, not binary

SVG files in drag-and-drop are read via `file.text()` (not `arrayBuffer()`), then passed to `placeSVGFile()`. The MIME type `image/svg+xml` is checked separately from raster images.

### 4. Viewport center: use `canvasViewportCenter()` everywhere

Replace:
- `AssetItem.viewportCenter()` 
- `ImageAssetItem.placeAtCenter()`
- `pasteFromHTML` fallback center

With `store.canvasViewportCenter()`.
