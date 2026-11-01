# Core

Renderer, layout, editor, Figma API, tools, clipboard, vector conversion, and document I/O. Depends on scene-graph, pen, kiwi, and fig. Framework-neutral: no Vue, no app imports, no browser DOM; guard browser globals explicitly.

- The root entry is the editor (`createEditor` and its types); every other domain is a subpath listed in `packages/core/package.json` `exports`. Add a subpath there rather than deep-importing, and never re-export another package's names.
- CanvasKit runtime loading is centralized in `@open-pencil/core/canvaskit`, which loads the full build so every host encodes JPEG and WebP itself, as headless raster export's own `canvaskit-wasm/full` does; elsewhere `import type` and pass CanvasKit in (`packages/core/tests/io/formats/raster/pixels.test.ts`).
- Start a worker module with `new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })`: the `.js` spelling reaches the `.ts` source under Vite and Bun and the built file in `dist`, where a `.ts` URL has nothing to load (`packages/core/src/layout/arrange/elk.ts`).
- Node-only helpers live under `@open-pencil/core/node/*`, which nothing browser code imports. Files the CLI, MCP server, and harness replace are written with `writeFileAtomic` from `@open-pencil/core/node/fs` rather than a hand-rolled temporary file and rename; only a document saved in place follows a symlink (`packages/core/tests/node/fs.test.ts`).
- Drawing and input share preview-aware geometry through `@open-pencil/core/geometry`, built on Scene Graph matrices. Use it for world/screen transforms, inverses, bounds, and handle placement.
- Content an author wrote (design JSX, HTML, `.pen`) gets its sizes and positions from `layoutAuthoredNodes` in `packages/core/src/layout.ts`, which measures text that resizes to its content wherever it sits and then lays out the pages involved; renderers and readers of authored formats call it, while `.fig` keeps the geometry it stores (`packages/core/tests/layout/authored.test.ts`).
- `.pen` documents draw as pen.dev draws them. `bun tools/generate/visual-oracles/src/cli.ts compare pen` exports every frame of the document open in pen.dev into `tests/fixtures/pen-oracles/` with the icons and fonts it uses; a new reading rule adds a probe frame there and a threshold to its `manifest.json` (`packages/core/tests/io/formats/pen/oracle.test.ts`).
- HTML is styled by whoever has a CSS runtime and built into layers by `sceneGraphFromStyledHTML` (`packages/core/src/io/formats/html/layers.ts`), which browser builds may bundle. `readHTMLDocument` and `headlessHTMLReader` use the headless CSS runtime, which cannot be bundled for browsers, so they stay out of `BUILTIN_IO_FORMATS` and the CLI registers the reader (`packages/core/tests/io/formats/html/import.test.ts`).
- Copies of part of a document, such as previews, history snapshots, and exports, come from `extractPageContext` or `extractExportGraph` in `packages/core/src/io/subgraph.ts`, not another copier. Pass `componentSets` when instances must switch variant and `shareTables` for a read-only view rebuilt often (`packages/core/tests/io/subgraph.test.ts`).
- An edit that records the document changes it makes, as AI and MCP calls do, runs through `recordEdit`, or `recordEditAsync` when it awaits, which keeps the edit open until its step is recorded so undoing it returns the document to saved; capturing a change by hand fails `open-pencil/no-document-change-capture` (`packages/core/tests/editor/history/edit.test.ts`).
- The recording copies only what an edit touches: the edit's page is copied up front, and another page or the document node the first time `SceneGraph.observeNodeChanges` reports it about to change, so code that writes into a node directly calls `willChangeNode` first. Copies share values rather than deep-copying, so values must be replaced rather than written into, apart from the child lists, source metadata, and override maps it copies; comments on the document node stay out of undo (`packages/core/tests/editor/history/document-change.test.ts`).

## Layout

- `@open-pencil/yoga-layout` supplies both flexbox and CSS Grid.
- Recompute layout after demo creation and for each materialized or imported page; scope computation to the affected page or subtree where possible.
- The first Hug/Fill dimension mutation switches only that axis to Fixed; focus is non-destructive, and mode/value changes share one undo transaction.
- Arranging layers runs through `packages/core/src/layout/arrange/`: `arrangeBoxes` runs an ELK layout (spread, compact, pack, flow, tree, radial, network), loaded on first use, `applyArrangement` moves the layers that draw it and joins their connectors, routing them when they flow, and `arrangeLayers` does both for layers already on a page, finding the connectors between them; importers and tools that arrange layers go through them, and connectors that pass through stored bend points use `bendConnectorThrough` (`packages/core/tests/layout/arrange/layers.test.ts`).
- A shape with text fits itself to its label before its auto layout runs: it grows from its given size only while the label needs room, and layout never changes that given size (`packages/core/tests/layout/generated/shape-with-text.test.ts`).

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
- Shared scene-authoring guidance and tested examples live under `packages/design-jsx/src/reference/`; `reference/index.ts` combines them with renderer metadata. Prompts under `packages/core/src/tools/prompts/` and the app chat/ACP prompt compose that reference rather than copying it. Run `bun run generate:authoring-reference` after changes; `check:authoring-reference` (part of `check:docs`) verifies the committed skill/docs copies. Do not edit generated reference files.
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
- A read-only document (`setReadOnly`) refuses every editor action not listed in `READ_ONLY_ACTIONS`, so a new action that only reads, selects, or navigates is added there; front ends ignore the refusal and change only what behaves differently, such as the toolbar (`packages/core/tests/editor/read-only.test.ts`).
- A canvas pane behaves by its profile (`resolveEditorProfile` in `packages/core/src/editor/views/`): the document's kind (design or board) decides its tools, tool keys, and snap grid, its view the pointer, shortcuts, editing chrome, live islands, panels, and where leaving goes, and the host's restrictions narrow both. A new kind, view, or host limit is a new entry there; other code reads profile values, never the kind, view, or restrictions themselves, which `open-pencil/no-editor-profile-inputs` enforces (`packages/core/tests/editor/views/profile.test.ts`).
- Renderer interaction policy uses explicit `beginInteractiveEdit()` leases and `isInteractiveEditing()`, not undo batching. Release leases on every terminal path. Keep live queries callable across app facades that spread editor actions.
- `packages/core/src/editor/history/atomic-tool.ts` owns synchronous property/variable transactions for AI, MCP, and WebMCP tools; see Tools above.

## OpenPencil API

`OpenPencilAPI` (`packages/core/src/openpencil-api/`) is what OpenPencil adds to the Plugin API, exposed to scripts as the `openpencil` global next to `figma`.

- Put OpenPencil-only features on `openpencil`, in the same style as `figma`: methods and node-like handles with getters and setters, not parallel helper functions. `figma` stays Figma's (Figma API, Shape follows Figma).
- Script runners get both globals only through `compileScript` (`packages/core/src/tools/analyze/eval/wrap.ts`); the `eval` tool, `openpencil eval`, and app automation must not build their own `AsyncFunction`.
- Members take names, not internal ids, and write through the same scene-graph functions the editor's actions use, such as `behaviourFromSpec`; errors name what exists. Tools for the same feature wrap the `openpencil` API rather than reimplementing it (`packages/core/src/tools/create/behaviours.ts`).
- A new member updates `packages/docs/programmable/cli/scripting.md` and the agent skill in the same change; tests drive it as scripts do, through `compileScript` (`packages/core/tests/openpencil-api/`).

## Renderer

Canvas is CanvasKit (Skia WASM) on a WebGL surface, not DOM.

### Invalidation

- `renderVersion` is a canvas repaint (pan, zoom, hover); `sceneVersion` is a scene-graph mutation. `requestRender()` bumps both; `requestRepaint()` bumps only `renderVersion`. UI that only cares about graph data must not watch repaint-only state.
- `renderNow()` is only for surface recreation and font loading, where an immediate draw is required.
- The resize observer uses a rAF throttle, not a debounce; debounce causes canvas skew.
- Viewport culling skips off-screen nodes; unclipped parents are not culled because children may extend beyond bounds.
- Overscan images accelerate navigation; settled scenes rasterize existing retained pictures at the live viewport size and origin. Pixel-grid alignment alone does not guarantee Skia anti-aliasing parity. Keep settlement pending until the viewport pass completes; do not add a second viewport image cache.

### Paints

- A gradient or image paint builds a Skia shader through `applyGradientFill` and `applyImageFill` (`packages/core/src/canvas/fills.ts`), which take the target `Paint`, so a stroke reuses them instead of a second shader path. Both say whether they set one; a caller skips the paint when they did not, since CanvasKit builds no gradient from a transform it cannot invert and an image may not be decoded yet (`packages/core/tests/canvas/paints.test.ts`).
- `packages/core/src/canvas/scene.ts` walks the tree and dispatches: text draws in `canvas/text/render.ts`, a layer's strokes in `canvas/strokes/dispatch.ts`, and a shape with effects through its raster or picture cache in `canvas/renderer/effect-raster-cache.ts`; keep `scene.ts` to traversal and move a new drawing domain beside those.
- `forVisibleStrokes` (`packages/core/src/canvas/strokes.ts`) is where a stroke's shader and dash are set and cleared, for shapes and booleans alike; stroke draw helpers take an already-configured `strokePaint` and must not reset its shader, and a dash goes on through `withStrokeDash`, which frees the effect (`packages/core/tests/canvas/strokes.test.ts`).
- Shadows are cast from what a layer draws, children included, through `drawSilhouette` (`packages/core/src/canvas/shadows/silhouette.ts`); a container's shadows are drawn by `renderLayerShadows` around its children, not by `renderShape`. A faster path for a shape must give the same pixels as its silhouette (`packages/core/tests/canvas/shadows.test.ts`).

### Caches

- Bounded rendering caches share `packages/core/src/cache/resource.ts` for recency, count/weight accounting, and removal disposal. Domain adapters own keys, font/page/dependency invalidation, and sizing units; use non-touching `peek()` for FIFO or planning reads. Rejected insertions leave ownership with the caller.
- Keep weak memos, async request registries, pools, and dependency-owned picture/path maps on their distinct lifetime policies.
- CanvasKit path caches are built with `createPathCache` and weighed by points; node paths live in the renderer's `NodePathCaches`, whose `store` keeps a path too large to cache until the next frame or export starts (`packages/core/tests/canvas/paths/cache.test.ts`).
- Set fill types on the detached `Path`, never on a `PathBuilder`: in CanvasKit 0.41 `PathBuilder.setFillType` returns an undeleted copy of the builder (`packages/core/src/vector/index.ts`).
- Paragraph construction is typed against `packages/core/src/canvas/text/paragraph/inputs.ts`; the same inputs drive preparation-cache invalidation. Add a mutation case when extending that contract. Drawing borrows native paragraphs; the renderer owns their bounded cache and destruction.
- Text lays out through `buildParagraph` into a `TextLayout` (`packages/core/src/canvas/text/layout/`): one native paragraph for plain text, or one per paragraph with its list indent, marker, and spacing, since Skia has no hanging indent. Drawing, measurement, the text editor, saved glyphs (`shapeText`), and text outlines all read that layout rather than laying text out again (`packages/core/tests/canvas/text/lists.test.ts`).
- Emoji are 1 em squares with their image drawn over, once per text and apart from the fills, as Figma does: `drawSavedEmoji` over a saved glyph's placeholder square (`emojiCodePoints`), `drawLaidOutEmoji` over the blank square the layout gives a character it falls back to `OpenPencil Emoji Metrics` for, the last fallback family, generated by `bun run generate:emoji-metrics`. The image comes from the browser's emoji font through a 2D canvas, or from Noto Color Emoji that `prepareGraphFonts` loads where nothing draws platform emoji (`tests/e2e/canvas/saved-glyph-visual.spec.ts`).
- A keycap mark (U+20E3) is laid out as a zero-width space (`laidOutText`), since CanvasKit shapes it with the key's font, which lacks it; its frame, Noto Sans Symbols' outline that Figma draws, is drawn in the text's paint and saved apart (`packages/core/src/canvas/text/keycap.ts`, written by `bun run generate:emoji-metrics`; `packages/core/tests/canvas/text/shape.test.ts`).

### Text decorations

- Underlines and strikethroughs come from `textDecorationRects` (`packages/core/src/canvas/text/decorations.ts`), Figma's geometry over laid-out or saved glyphs, both for drawing and for the rects `.fig` files save, which Figma draws decorations from; Skia's paragraph decorations stay off. Drawn decorations are kept with the prepared text, whose paragraph inputs cover them, or by saved glyphs in the renderer's `derivedDecorationCache` (`packages/core/tests/canvas/text/decorations.test.ts`).

### Geometry and overlays

- Use `@open-pencil/core/geometry` for world/screen transforms, inverses, bounds, and handle placement instead of interpreting ancestor rotations or reflections independently.
- Label drawing and hit testing share `packages/core/src/canvas/labels/{layout,transform,style}.ts`, including paragraph measurements and unreflected label axes.
- Editor chrome sized in screen pixels (outlines, borders, carets, highlights) draws in the overlay pass, never in the scene, which is cached and scaled while navigating. Draw outlines with `withScreenStroke` and `inNodeSpace` (`packages/core/src/canvas/overlays/outline.ts`). `open-pencil/no-zoom-in-scene-drawing` enforces it.
- Selection border width is constant regardless of zoom: divide by scale. Section and frame title text never scales: render at a fixed font size and ellipsize to fit.
- Rulers are rendered on the canvas with selection range badges that do not overlap tick numbers. Remote cursors are Figma-style colored arrows with a white border and name pill, rendered in screen space.

### Visual coverage

Pixel-affecting features need committed visual coverage, not only mock or geometry assertions. Add or update a Playwright canvas snapshot for changes to fills, gradients, images, blend modes, masks, boolean geometry, corners, strokes, shadows, blur, text rendering, or demo showcase scenes. Use targeted updates such as `bun run test tests/e2e/canvas/fill-modes-visual.spec.ts --update-snapshots`, then rerun the same test without `--update-snapshots`.

## Figma API

`FigmaAPI` mimics Figma's Plugin API over the SceneGraph. `openpencil eval`, the AI and MCP tools, and the app bind to it. Tests live under `packages/core/tests/figma-api/` and mirror `packages/core/src/figma-api/`.

- **Shape follows Figma.** Match `@figma/plugin-typings` at the version pinned in the root `package.json`, and add every new member to `SupportedPluginAPI`. `compatibility.ts` fails the typecheck on a member Figma's types lack or type differently, and `packages/core/tests/figma-api/surface.test.ts` on one a script can reach; the lists in `packages/core/src/figma-api/surface.ts` only shrink.
- **Behavior follows Figma.** Read the Plugin API documentation for the member, and for anything observable (geometry, ordering, defaults, errors) run the same script in live Figma and record the observed result in the test. `figma-use` and `tests/figma/` are the live oracle; `tests/fixtures/figma-oracles/` holds recorded values.
- **User actions are shared code.** When an editor command does the same thing (group, ungroup, boolean, flatten, instance creation, component sync), call the implementation under `packages/core/src/editor/` or its shared helper. Do not reimplement geometry, placement, or propagation here; new geometry helpers belong in Scene Graph.
- Geometry getters lay out what the graph's edits touched since the last read, as Figma does, through `flushPendingLayout` in `packages/core/src/figma-api/pending-layout.ts`; a new geometry getter calls it first (`packages/core/tests/figma-api/pending-layout.test.ts`).
- Node proxies live in `packages/core/src/figma-api/proxy.ts` and `packages/core/src/figma-api/accessors/`; per-character text styles are modelled in `packages/core/src/text/character-style.ts`, which the editor's selection styling shares, and read for scripts in `packages/core/src/figma-api/text/style.ts`, which node getters, range methods, and segments all use (`packages/core/tests/figma-api/text/styles.test.ts`); `packages/core/src/figma-api/render-bounds.ts` implements Figma's `absoluteRenderBounds` semantics and is the only geometry that is Figma-specific.
- `packages/core/src/figma-api/index.ts` stays under the 600-line limit by moving whole domains into sibling modules such as `components.ts` and `text/`, not by extracting generic helpers into this folder.
