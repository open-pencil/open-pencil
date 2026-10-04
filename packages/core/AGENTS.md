# Core

Renderer, layout, editor, Figma API, tools, clipboard, vector conversion, and document I/O. Depends on scene-graph, pen, kiwi, and fig. Framework-neutral: no Vue, no app imports, no browser DOM; guard browser globals explicitly.

- Public surface is the compatibility barrel plus the subpaths listed in `packages/core/package.json` `exports`; add a subpath there rather than deep-importing.
- CanvasKit runtime loading is centralized in `@open-pencil/core/canvaskit`. Headless raster export may dynamically load `canvaskit-wasm/full`; elsewhere `import type` and pass CanvasKit in.
- Drawing and input share preview-aware geometry through `@open-pencil/core/geometry`, built on Scene Graph matrices. Use it for world/screen transforms, inverses, bounds, and handle placement.

## Layout

- `@open-pencil/yoga-layout` supplies both flexbox and CSS Grid.
- Recompute layout after demo creation and for each materialized or imported page; scope computation to the affected page or subtree where possible.
- The first Hug/Fill dimension mutation switches only that axis to Fixed; focus is non-destructive, and mode/value changes share one undo transaction.

## Components and instances

- Component types use `#9747ff`.
- Component edits propagate through editor component sync in `packages/core/src/editor/components/`; never hand-copy properties in app UI. Use Scene Graph copy helpers for nested values.

## Vector conversion

- Bitmap-to-vector conversion lives in `packages/core/src/vector/vectorize/`; app provider clients, preferences, and credential resolution live under `src/app/editor/vectorize/` in the app. Bound request and response sizes and validate provider-owned download URLs before importing returned SVG.

## Tools (AI, MCP, CLI, WebMCP)

- Operations are `ToolDef`s under `packages/core/src/tools/**`; `schema.ts` defines the contract and registries expose them. Each definition owns its native Valibot `input`, execution/mutation metadata, and optional per-interface exposure exclusions (`mcp`, `ai`, `webmcp`). Exposure defaults to inclusion; adapters use `isToolExposed()`, then apply execution support and user permissions independently.
- Infer arguments from the schema; derive effects and default capabilities from execution metadata. Do not maintain parameter DSLs or tool-name lists. Add work to the nearest existing domain and the appropriate registry.
- `packages/core/src/tools/ai-adapter.ts` converts ToolDefs for Vercel AI; the app binds them to the active editor's `FigmaAPI` in `src/app/ai/tools/index.ts`. MCP v2 registration uses Standard Schema with Valibot JSON Schema conversion; AI and WebMCP adapters share the same input contract.
- `packages/core/src/editor/history/atomic-tool.ts` owns synchronous property/variable transactions; Scene Graph owns checkpoint recovery. AI, MCP, and WebMCP share this execution path. Async and structural tools cannot declare atomic property execution.
- Shared scene-authoring guidance and tested examples live under `packages/design-jsx/src/reference/`; `reference.ts` combines them with renderer metadata. Prompts under `packages/core/src/tools/prompts/` and the app chat/ACP prompt compose that reference rather than copying it. Run `bun run generate:authoring-reference` after changes; `check:authoring-reference` (part of `check:docs`) verifies the committed skill/docs copies. Do not edit generated reference files.
- The installable agent skill is maintained in `skills/open-pencil/`. Changes to agent-facing APIs, CLI/MCP behavior, or design authoring must update affected skill examples, prompts, and public documentation in the same change. Keep examples valid in their actual execution environment; do not advertise library exports as scripting globals unless exposed there. Prefer runtime discovery and canonical references over duplicated API/tool inventories.
- MCP-only tools and transports: `packages/mcp/AGENTS.md`. WebMCP registration and app completion: `src/AGENTS.md`.

## Editor

`createEditor()` in `packages/core/src/editor/create.ts` assembles an `EditorContext` plus domain action modules for viewport, selection, pages, shapes, structure, components, clipboard, undo/history, text, variables, layout, color space, graph reads, and the tool registry. `Editor` is `ReturnType<typeof createEditor>`. Check the folder before adding behavior; keep new actions in the nearest domain module or folder instead of growing unrelated files. Modules share state through `EditorContext`, never through app code or Vue.

- All selection mutations go through `ctx.setSelectedIds()` and all tool changes through `ctx.setActiveTool()` so events fire consistently. App code uses editor actions such as `clearSelection()`, `select()`, or `setTool()`, never direct `state.selectedIds =` or `state.activeTool =` assignments.
- The editor exposes a typed nanoevents emitter. Event names and payloads live in `EditorEvents` in `packages/core/src/editor/types.ts`; graph events are bridged from SceneGraph by `packages/core/src/editor/graph-events.ts`. Subscribe with `editor.onEditorEvent(event, handler)`; in Vue use `useEditorEvent()` from `packages/vue/src/editor/events/use.ts`. UI that only cares about graph data should use editor events for incremental surfaces such as the layer tree instead of watching repaint-only state.
- Commands under `packages/core/src/editor/structure/` (group, boolean, container wrap, flatten) and `packages/core/src/editor/components/` are the canonical implementations of user actions. The Figma API, tools, and app call them or share their helpers; do not reimplement sizing, placement, or propagation elsewhere.
- Live property controls use selected-node projections from `packages/core/src/editor/selection-state/nodes.ts`: shallow reactive copies that receive `node:previewUpdated` patches at property granularity. Never add preview invalidation to all `useSceneComputed` consumers; catalogs and unrelated controls must not refresh for geometry previews. Projection subscriptions belong to the consuming scope or session and must be disposed.
- Numeric geometry edits own a `beginNodePreview()` handle with `update`, `commit`, and `cancel`. It captures all affected fields and layout children, publishes the complete delta once, and restores exact originals on cancellation. Selection, page, and graph changes and disposal cancel the old edit; trailing input must not target the new selection. Controls must close previews even when a gesture returns to its starting value.
- Rotation previews change through `setRotationPreview()` and `rotation:preview-changed`; cancellation must close the owning gesture without deselecting or committing it.
- Renderer interaction policy uses explicit `beginInteractiveEdit()` leases and `isInteractiveEditing()`, not undo batching. Release leases on every terminal path. Keep live queries callable across app facades that spread editor actions.
- `packages/core/src/editor/history/atomic-tool.ts` owns synchronous property/variable transactions for AI, MCP, and WebMCP tools; see Tools above.

## Renderer

Canvas is CanvasKit (Skia WASM) on a WebGL surface, not DOM.

### Invalidation

- `renderVersion` is a canvas repaint (pan, zoom, hover); `sceneVersion` is a scene-graph mutation. `requestRender()` bumps both; `requestRepaint()` bumps only `renderVersion`. UI that only cares about graph data must not watch repaint-only state.
- `renderNow()` is only for surface recreation and font loading, where an immediate draw is required.
- The resize observer uses a rAF throttle, not a debounce; debounce causes canvas skew.
- Viewport culling skips off-screen nodes; unclipped parents are not culled because children may extend beyond bounds.
- Overscan images accelerate navigation; settled scenes rasterize existing retained pictures at the live viewport size and origin. Pixel-grid alignment alone does not guarantee Skia anti-aliasing parity. Keep settlement pending until the viewport pass completes; do not add a second viewport image cache.

### Paints

- A gradient or image paint builds a Skia shader through `applyGradientFill` and `applyImageFill` (`packages/core/src/canvas/fills.ts`), which take the target `Paint`, so a stroke reuses them instead of a second shader path.
- `forVisibleStrokes` (`packages/core/src/canvas/scene.ts`) is where a stroke's shader is set and cleared; stroke draw helpers take an already-configured `strokePaint` and must not reset its shader.

### Caches

- Bounded rendering caches share `packages/core/src/cache/resource.ts` for recency, count/weight accounting, and removal disposal. Domain adapters own keys, font/page/dependency invalidation, and sizing units; use non-touching `peek()` for FIFO or planning reads. Rejected insertions leave ownership with the caller.
- Keep weak memos, async request registries, pools, and dependency-owned picture/path maps on their distinct lifetime policies.
- Paragraph construction is typed against `packages/core/src/canvas/text/paragraph-inputs.ts`; the same inputs drive preparation-cache invalidation. Add a mutation case when extending that contract. Drawing borrows native paragraphs; the renderer owns their bounded cache and destruction.

### Geometry and overlays

- Use `@open-pencil/core/geometry` for world/screen transforms, inverses, bounds, and handle placement instead of interpreting ancestor rotations or reflections independently.
- Label drawing and hit testing share `packages/core/src/canvas/labels/{layout,transform,style}.ts`, including paragraph measurements and unreflected label axes.
- Selection border width is constant regardless of zoom: divide by scale. Section and frame title text never scales: render at a fixed font size and ellipsize to fit.
- Rulers are rendered on the canvas with selection range badges that do not overlap tick numbers. Remote cursors are Figma-style colored arrows with a white border and name pill, rendered in screen space.

### Visual coverage

Pixel-affecting features need committed visual coverage, not only mock or geometry assertions. Add or update a Playwright canvas snapshot for changes to fills, gradients, images, blend modes, masks, boolean geometry, corners, strokes, shadows, blur, text rendering, or demo showcase scenes. Use targeted updates such as `bun run test tests/e2e/canvas/fill-modes-visual.spec.ts --update-snapshots`, then rerun the same test without `--update-snapshots`.

## Figma API

`FigmaAPI` mimics Figma's Plugin API over the SceneGraph. `openpencil eval`, the AI and MCP tools, and the app bind to it. Tests live under `tests/engine/figma/api/` and mirror the API surface.

- **Shape follows Figma.** Match `@figma/plugin-typings` at the version pinned in the root `package.json`. `packages/core/src/figma-api/compatibility.ts` type-checks the supported surface against `PluginAPI`; add every new member to `SupportedPluginAPI` there. Model unsupported members explicitly rather than approximating them.
- **Behavior follows Figma.** Read the Plugin API documentation for the member, and for anything observable (geometry, ordering, defaults, errors) run the same script in live Figma and record the observed result in the test. `figma-use` and `tests/figma/` are the live oracle; `tests/fixtures/figma-oracles/` holds recorded values.
- **User actions are shared code.** When an editor command does the same thing (group, ungroup, boolean, flatten, instance creation, component sync), call the implementation under `packages/core/src/editor/` or its shared helper. Do not reimplement geometry, placement, or propagation here; new geometry helpers belong in Scene Graph.
- Node proxies live in `packages/core/src/figma-api/proxy.ts` and `packages/core/src/figma-api/accessors/`; `packages/core/src/figma-api/render-bounds.ts` implements Figma's `absoluteRenderBounds` semantics and is the only geometry that is Figma-specific.
- `packages/core/src/figma-api/index.ts` stays under the 600-line limit by moving whole domains into sibling modules such as `components.ts` and `text.ts`, not by extracting generic helpers into this folder.
