## Context

Current `origin/master` renders one `EditorCanvas` per active tab. `EditorCanvas.vue` mounts a scene canvas and overlay canvas, wires `useCanvas`, `useCanvasInput`, text edit, drop handling, canvas context menu, and collaboration awareness against `useEditorStore()`.

The core `EditorState` still mixes document-wide state and view-local state in one object: `currentPageId`, `selectedIds`, `panX`, `panY`, `zoom`, hover, text/pen/node-edit/drag overlays, remote cursors, render counters, loading, and document metadata. Vue canvas rendering passes `editor.state` directly to `renderFromEditorState()`, and input helpers mutate `editor.state` directly. Singleton services such as keyboard, command registry, export, panels, and collaboration resolve one active editor/store.

The refreshed Evoton pack `../../evoton/docs/studies/open-pencil-main-split-canvases-refresh/` records this current-main source inspection. It recommends rebuilding same-document split panes on current main with pane-local state first, rejecting layout-only duplicated `EditorCanvas`, reusing the existing multiple-renderer lifecycle with pane-specific render-state hooks, routing singleton services through active pane, and capping visible panes until resource measurements exist.

Key evidence trace from the pack:

| Evidence ID | Current-main source | Captured finding |
| --- | --- | --- |
| `source:main-editor-state-mixed-view-document` | `packages/core/src/editor/state.ts`, `packages/core/src/editor/types.ts` | `EditorState` mixes document and view fields such as page, selection, hover, pan/zoom, interaction state, and document metadata. |
| `source:main-core-multiple-renderers` | `packages/core/src/editor/create.ts` | Core editor tracks a `Set<SkiaRenderer>`, so multiple surfaces are mechanically supported, but state is still single/global. |
| `source:main-vue-canvas-renders-global-state` | `packages/vue/src/canvas/surface/use.ts`, `surface/lifecycle.ts` | Canvas rendering calls `renderFromEditorState(editor.state, ...)` with no pane render-state hook. |
| `source:main-vue-input-mutates-global-state` | `packages/vue/src/canvas/useCanvasInput.ts` and shared input helpers | Input reads/mutates one `editor.state`, so duplicate canvases would mirror interactions. |
| `source:main-editor-canvas-single-host` | `src/components/EditorCanvas.vue` | Current canvas host wires one active store to scene/overlay canvases, input, text edit, drop, menu, and collab awareness. |
| `source:main-editor-view-single-canvas` | `src/views/EditorView.vue` | Desktop, mobile, collapsed, and bare branches each mount one `EditorCanvas` for the active tab. |
| `source:main-active-store-singleton-proxy` | `src/app/editor/active-store/index.ts` | `useEditorStore()` proxies one active `EditorStore`; active-pane routing must layer on top. |
| `source:main-commands-single-editor-context` | `packages/vue/src/editor/commands/use.ts`, `src/app/shell/keyboard/use.ts` | Command and keyboard paths resolve one current editor context. |

## Goals / Non-Goals

**Goals:**

- Support multiple independently interactive canvas panes for one document/store.
- Keep graph, undo, document IO, autosave, active tool, loading, tabs, and collaboration shared per document.
- Make page, viewport, selection, hover, cursor, remote cursor projection, and transient overlays pane-local.
- Preserve current single-canvas behavior through compatibility APIs during migration.
- Render recursive split panes with Reka UI splitter primitives.
- Reuse CanvasKit/SkiaRenderer and existing multi-renderer lifecycle.
- Route singleton UI and commands through the active pane.
- Cleanly commit/cancel long-running interactions on pane switch/close, page switch, and graph replacement.
- Enforce a conservative initial visible-pane cap.

**Non-Goals:**

- Showing different documents in split panes.
- Separate undo stacks per pane.
- Per-pane active tools in the first slice.
- Persisting split layout in `.fig` files.
- Replacing CanvasKit, renderer architecture, or Reka splitter primitives.
- Unlimited visible panes, pane virtualization, or inactive pane throttling in the first slice.
- New explicit non-active automation/MCP targeting APIs.

## Decisions

### Decision: Use one shared document editor plus pane-local view state

One `EditorStore` remains the document owner. A new pane registry stores pane-local view state and split tree state for that document. Shared state includes graph, undo, IO, active tool, loading, document metadata, and collaboration room. Pane-local state includes current page, selection, pan/zoom, viewport size, hover, entered container, cursor, remote cursor projection, marquee, snap/rotation/drop/layout overlays, page viewport memory, and tool interaction state that cannot be safely shared.

Alternatives considered:

- **Layout-only duplicate `EditorCanvas`**: rejected because current main would mirror page, selection, pan, zoom, hover, and interactions across panes.
- **Full `EditorStore` per pane**: rejected because it duplicates graph, undo, IO, autosave, and collaboration ownership for one document.
- **Hidden global state swapping**: rejected because multiple render/input loops and async font/render events would be order-dependent.

### Decision: Add pane-bound editor facade

Canvas input, render, page/selection/viewport UI, and pane-sensitive singleton services should use a pane-bound facade rather than raw `editor.state`. The facade reads shared document data from the editor/store and pane-local data from the pane registry.

The compatibility `useEditorStore()` path can remain, but active-pane-sensitive getters/actions should resolve through the active pane facade so existing panels and commands migrate incrementally.

### Decision: Classify state ownership before refactor

The implementation starts by explicitly classifying fields:

- Shared: graph, undo, document IO/source, autosave, `activeTool`, loading, document metadata, scene version, sidebars/toolbar state.
- Pane-local: current page, selected IDs, pan/zoom, viewport dimensions, hover, entered container, cursor, marquee, snap guides, remote cursor projection, page viewport memory, rotation/drop/layout overlays.
- Guarded pane-local interactions: text edit, pen state, node/vector edit, transform/drag state, auto-layout padding edit.

Undo remains document-wide. Undo/redo should not mutate inactive pane-local page/viewport/selection except to sanitize IDs invalidated by graph changes.

### Decision: Extend rendering with pane-specific state hooks

`useCanvas()` and the surface render loop gain optional hooks such as `getRenderState()` and `onViewportResize(width, height)`. Legacy callers without these hooks keep rendering `editor.state`.

Graph mutations increment shared scene invalidation and repaint all panes. Pane-only viewport/page/selection/hover changes increment only the target pane's render counter unless they also mutate the graph.

### Decision: Render recursive split UI with Reka primitives

The central canvas host becomes a recursive split tree using `SplitterGroup`, `SplitterPanel`, and `SplitterResizeHandle`. Split sizes are stored in the pane registry, not via Reka `autoSaveId` in the first slice. Split tree helpers must preserve stable pane IDs, validate layout payloads, collapse one-child parents, and refuse last-pane close.

### Decision: Active pane drives singleton UI

Properties, layers, page list, toolbar, zoom controls, context menu, keyboard shortcuts, clipboard defaults, export defaults, automation/FigmaAPI context, and collaboration local/remote cursor projection read the active pane. Pointerdown, focus, contextmenu, wheel/gesture start, and drop enter activate the source pane before command handling.

### Decision: Collaboration remains one document room with pane-derived presence

For same-document panes, collaboration remains scoped to the document store/room. Raw peer awareness remains shared for the document. Each pane derives visible remote cursors by comparing peer page with that pane's current page. Local cursor/selection broadcast uses the active pane for the connected document.

### Decision: First slice uses split root everywhere, but mobile is single-pane only

Desktop, collapsed, bare, and mobile branches should all mount `CanvasSplitRoot` so lifecycle and compatibility paths stay unified. Mobile does not expose split controls in the first slice and recovers/refuses to one visible pane. Desktop, collapsed, and bare layouts may expose split controls subject to the pane cap.

### Decision: First-slice pane-local overlay and interaction ownership

Pane-local first-slice state includes marquee, snap guides, rotation preview, drop target, layout insert indicator, hover, entered container, cursor, remote cursor projection, node edit state, text editing state, pen state, vector/node-edit state, transform drag state, and auto-layout padding edit state. Any overlay outside this list must either be explicitly classified before implementation or guarded so it only runs on the active pane.

Interaction cleanup policy:

| Interaction | Pane switch | Pane close | Graph replacement |
| --- | --- | --- | --- |
| Text edit | Commit | Commit before close | Commit if node still exists, otherwise cancel |
| Move/resize/rotation preview | Commit if pointer-up equivalent is safe, otherwise cancel preview | Cancel preview and restore pre-preview state | Cancel preview |
| Marquee/text selection drag | Cancel | Cancel | Cancel |
| Pen in-progress path | Cancel unless a valid committed node exists | Cancel | Cancel |
| Vector/node edit drag | Commit completed point/handle mutation if already applied through undo action, otherwise cancel preview | Cancel active drag | Clear invalid edit state |
| Auto-layout padding edit | Commit current finite value | Commit current finite value before close | Cancel if node no longer exists |
| Drop/layout insert indicator | Clear | Clear | Clear |

### Decision: Resource guardrail starts conservative

Use `MAX_VISIBLE_CANVAS_PANES = 4` unless current-main implementation findings force a lower cap. Split actions must be disabled/no-op before creating panes or canvases once the cap is reached. Resource tuning and virtualization are follow-ups.

## Risks / Trade-offs

- **Broad state refactor** → Start with named shared/pane state types, pure pane helpers, and compatibility accessors before rendering multiple panes.
- **Render loops use wrong state** → Pass explicit pane render state to each canvas and test panes with different page/pan/zoom/selection.
- **Input helpers still mutate global state** → Introduce pane-bound editor facade and migrate input by domain: viewport/page/selection first, then transforms/text/pen/node-edit.
- **Long-running interactions leak** → Commit or cancel on pane switch, pane close, page switch, and graph replacement.
- **Singleton services target stale pane** → Activate pane before pointer/context/focus and classify commands as document-wide vs pane-sensitive.
- **WebGL resource pressure** → Enforce pane cap, test renderer disposal, and defer optimization.
- **Main keeps moving** → Keep this spec tied to the refreshed evidence pack and rerun targeted source inspection before implementation if `origin/master` advances significantly again.

## Migration Plan

1. Add pane state, split tree, and active pane registry with one default pane.
2. Add render state composition and pane render counters while preserving legacy single-canvas rendering.
3. Add pane-bound viewport/page/selection facade and migrate singleton computed refs.
4. Migrate canvas input to pane-bound state for basic pan/zoom/selection/page behavior.
5. Replace direct `EditorCanvas` hosts with recursive split components.
6. Audit singleton services and collaboration projection.
7. Harden long-running interaction cleanup and graph/page sanitization.
8. Add unit/component/E2E coverage and remove temporary compatibility shims where safe.

Rollback strategy: keep one-pane compatibility throughout. If recursive UI is unstable, disable split actions while leaving the pane registry with one active pane.

## Open Questions

- Should inactive pane selections use the same selection styling, dimmed styling, or hidden styling after the first implementation?
- Should the initial cap remain 4 after measuring current main in Tauri/WebView?
- Should split layout persist in localStorage per document path after the first release?
- Should mobile expose split controls after the first release, or remain single-pane long term?
