# Core (`packages/core`)

Renderer, layout, editor core, Figma API, tools, clipboard, vector conversion, and app/CLI-facing document I/O. Depends on scene-graph/pen/kiwi/fig/deck but keeps browser DOM out of core.

- Core code must guard browser APIs with explicit runtime checks such as `typeof window !== 'undefined'` / `typeof document !== 'undefined'` before using them.
- Core modules should share state through `EditorContext` rather than importing app code or Vue.
- `es-toolkit` is available in core for small, focused utility helpers when it clearly improves readability. Prefer subpath imports such as `es-toolkit/object`, `es-toolkit/array`, and `es-toolkit/predicate`; good fits include `omit` / `pick` for object key selection, `uniq` for dedupe, and `isNotNil` for typed nullish filtering. Do not replace clear native JavaScript just for consistency, and avoid `es-toolkit/compat` unless deliberately migrating lodash-compatible behavior.

## Editor architecture

`packages/core/src/editor/` is the framework-agnostic editor core. `createEditor()` in `create.ts` assembles an `EditorContext` plus domain action modules for viewport, selection, pages, shapes, structure, components, clipboard, undo/history, text, variables, layout, color space, graph reads, tool registry, and related helpers. Check the folder before adding editor behavior; keep new actions in the nearest domain module/folder instead of growing unrelated files.

`Editor` type = `ReturnType<typeof createEditor>`.

### Editor event bus

The editor exposes a typed nanoevents emitter. Event names/payloads live in `EditorEvents` in `packages/core/src/editor/types.ts`; graph events are bridged from SceneGraph by `graph-events.ts`. Subscribe with `editor.onEditorEvent(event, handler)`, or in Vue use `useEditorEvent(event, handler)` from `packages/vue/src/editor/events/use.ts`.

Important invariant: all selection mutations in core go through `ctx.setSelectedIds()` and all tool changes go through `ctx.setActiveTool()` so events fire consistently.

## Tools (AI / MCP / CLI)

- Framework-agnostic tool operations live under `packages/core/src/tools/**` as `ToolDef` objects. Domains include read, create, modify, structure, variables, vector, analyze, describe, codegen, stock-photo, and helpers. Check the existing domain folder before adding a new file.
- `schema.ts` defines `ToolDef`, `defineTool()`, and shared result helpers. Each tool has a name, description, typed params, and an `execute(figma: FigmaAPI, args)` function.
- Registries (`registry*.ts`) assemble tool sets. Add new tools to the appropriate registry so AI chat, MCP, and CLI eval paths can see them.
- AI adapter (`packages/core/src/tools/ai-adapter.ts`) converts ToolDefs to Vercel AI tools with valibot schemas.
- Core codegen prompts live as markdown under `packages/core/src/tools/prompts/`.
- `FigmaAPI` (`packages/core/src/figma-api/`) is the execution target for tools and CLI eval. It is Figma Plugin API compatible and uses Symbols for hidden internals.

## Rendering

- Canvas is CanvasKit (Skia WASM) on a WebGL surface, not DOM
- `renderVersion` vs `sceneVersion`: `renderVersion` = canvas repaint (pan/zoom/hover); `sceneVersion` = scene graph mutations. UI that only cares about graph data should avoid watching repaint-only state; use editor events for incremental surfaces such as the layer tree.
- `requestRender()` bumps both counters; `requestRepaint()` bumps only `renderVersion`
- `renderNow()` is only for surface recreation and font loading (need immediate draw)
- Resize observer uses rAF throttle, not debounce — debounce causes canvas skew
- Viewport culling skips off-screen nodes; unclipped parents are NOT culled (children may extend beyond bounds)
- Selection border width must be constant regardless of zoom — divide by scale
- Section/frame title text never scales — render at fixed font size, ellipsize to fit
- Rulers are rendered on the canvas (not DOM), with selection range badges that don't overlap tick numbers
- Remote cursors: Figma-style colored arrows with white border + name pill, rendered in screen space
- Pixel-affecting renderer features need committed visual coverage, not just mock/geometry assertions. Add or update a Playwright canvas snapshot for changes to fills, gradients, images, blend modes, masks, boolean geometry, corners, strokes, shadows, blur, text rendering, or demo showcase scenes. Use targeted snapshot updates such as `bunx playwright test tests/e2e/canvas/renderer-visuals.spec.ts --project=openpencil --update-snapshots` and then rerun the same test without `--update-snapshots`.

## Layout

- `computeAllLayouts()` must be called after demo creation and after opening .fig files
- Yoga WASM handles flexbox; CSS Grid blocked on upstream (facebook/yoga#1893)
- Auto-layout creation (Shift+A) must recompute layout immediately to update selection bounds
- Editing a Hug/Fill width or height switches only that axis to Fixed on the first value mutation; focus stays non-destructive, and mode plus value changes belong to one undo transaction

## CanvasKit

CanvasKit runtime loading is centralized in `@open-pencil/core/canvaskit` for app/browser use. Headless raster export may dynamically load `canvaskit-wasm/full`; elsewhere prefer `import type` and pass the CanvasKit instance in.

## File format and vector IO

- Core owns `.fig` IO orchestration in `packages/core/src/io/formats/fig/**`, runtime font/glyph integration, workers, and CanvasKit thumbnails. See `packages/fig/AGENTS.md` for the format package split.
- Vector data uses reverse-engineered `vectorNetworkBlob` binary format — encoder/decoder in `packages/core/src/vector/` and scene-graph vector-network types in `@open-pencil/scene-graph`.
- Bitmap-to-vector conversion lives in `packages/core/src/vector/vectorize/`; app provider clients and credentials live under `src/app/editor/vectorize/`.
- `.fig` export compression uses fflate in browser paths and Tauri Rust commands where available.
