# Renderer

Canvas is CanvasKit (Skia WASM) on a WebGL surface, not DOM.

## Invalidation

- `renderVersion` is a canvas repaint (pan, zoom, hover); `sceneVersion` is a scene-graph mutation. `requestRender()` bumps both; `requestRepaint()` bumps only `renderVersion`. UI that only cares about graph data must not watch repaint-only state.
- `renderNow()` is only for surface recreation and font loading, where an immediate draw is required.
- The resize observer uses a rAF throttle, not a debounce; debounce causes canvas skew.
- Viewport culling skips off-screen nodes; unclipped parents are not culled because children may extend beyond bounds.
- Overscan images accelerate navigation; settled scenes rasterize existing retained pictures at the live viewport size and origin. Pixel-grid alignment alone does not guarantee Skia anti-aliasing parity. Keep settlement pending until the viewport pass completes; do not add a second viewport image cache.

## Caches

- Bounded rendering caches share `packages/core/src/cache/resource.ts` for recency, count/weight accounting, and removal disposal. Domain adapters own keys, font/page/dependency invalidation, and sizing units; use non-touching `peek()` for FIFO or planning reads. Rejected insertions leave ownership with the caller.
- Keep weak memos, async request registries, pools, and dependency-owned picture/path maps on their distinct lifetime policies.
- Paragraph construction is typed against `packages/core/src/canvas/text/paragraph-inputs.ts`; the same inputs drive preparation-cache invalidation. Add a mutation case when extending that contract. Drawing borrows native paragraphs; the renderer owns their bounded cache and destruction.

## Geometry and overlays

- Use `@open-pencil/core/geometry` for world/screen transforms, inverses, bounds, and handle placement instead of interpreting ancestor rotations or reflections independently.
- Label drawing and hit testing share `packages/core/src/canvas/labels/{layout,transform,style}.ts`, including paragraph measurements and unreflected label axes.
- Selection border width is constant regardless of zoom: divide by scale. Section and frame title text never scales: render at a fixed font size and ellipsize to fit.
- Rulers are rendered on the canvas with selection range badges that do not overlap tick numbers. Remote cursors are Figma-style colored arrows with a white border and name pill, rendered in screen space.

## Visual coverage

Pixel-affecting features need committed visual coverage, not only mock or geometry assertions. Add or update a Playwright canvas snapshot for changes to fills, gradients, images, blend modes, masks, boolean geometry, corners, strokes, shadows, blur, text rendering, or demo showcase scenes. Use targeted updates such as `bun run test tests/e2e/canvas/fill-modes-visual.spec.ts --update-snapshots`, then rerun the same test without `--update-snapshots`.
