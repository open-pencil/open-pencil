## Implementation Status

Most first-slice implementation tasks are complete. Remaining unchecked items are explicit follow-up coverage gaps for component/E2E tests that require browser harness work beyond the targeted engine tests run in this pass.

## 1. State Ownership and Guardrails

- [x] 1.1 Add tests that lock current single-canvas page switch, pan/zoom, selection, export default, and keyboard command behavior before refactoring.
- [x] 1.2 Add `EditorSharedState` and `EditorPaneState` types with explicit ownership for current main fields.
- [x] 1.3 Add helpers to create default pane state from a page ID and optional legacy editor state.
- [x] 1.4 Add pane-local per-page viewport storage helpers with tests for save, restore, delete, and clear behavior.
- [x] 1.5 Add shared scene version and pane render version counters while preserving legacy `EditorState` compatibility.

## 2. Pane Registry and Split Tree

- [x] 2.1 Add pure split tree helpers for split, close, one-child parent collapse, leaf enumeration, child lookup, and size normalization.
- [x] 2.2 Add unit tests for split tree split/close/collapse, stable pane IDs, last-pane close refusal, cap refusal, and invalid layout payload rejection.
- [x] 2.3 Add per-document pane registry with one default pane and active pane recovery.
- [x] 2.4 Add pane registry sanitization for page deletion, graph replacement/reload, deleted node IDs, and invalid overlay IDs.
- [x] 2.5 Add pane viewport resize handling that updates only the target pane.
- [x] 2.6 Enforce `MAX_VISIBLE_CANVAS_PANES = 4` before creating panes, split nodes, or canvases.

## 3. Pane-Bound Editor Facade

- [x] 3.1 Add pane-bound viewport methods for screen/canvas conversion, pan, zoom, zoom to fit, zoom to 100%, zoom to selection, and viewport center.
- [x] 3.2 Add pane-bound selection reads and writes: select, clear selection, select all, get selected nodes, and get selected node.
- [x] 3.3 Add pane-bound page switching with pane-local viewport memory.
- [x] 3.4 Route active-pane-sensitive store getters and methods through the active pane facade while preserving single-pane behavior.
- [x] 3.5 Update selection/page computed refs so properties, layers, page UI, and command state react to active pane changes.
- [x] 3.6 Add tests proving active pane changes update singleton UI-derived state without mutating inactive panes.

## 4. Pane-Aware Rendering

- [x] 4.1 Add render state composition from shared document state plus target pane view state.
- [x] 4.2 Extend `useCanvas()` with optional `getRenderState` and `onViewportResize` hooks while preserving legacy callers.
- [x] 4.3 Update canvas surface render loop to observe shared scene invalidation plus target pane render version.
- [x] 4.4 Ensure graph mutations invalidate all pane renderers and pane-only viewport changes repaint only the target pane.
- [x] 4.5 Add tests for render state composition, independent pane render counters, and legacy rendering behavior.

## 5. Pane-Aware Canvas Input

- [x] 5.1 Update pointer geometry and hit-testing helpers to work with a pane-bound editor.
- [x] 5.2 Update wheel, gesture, touch, and hand-tool pan/zoom input to mutate only the target pane.
- [x] 5.3 Update selection, marquee, context selection, and drop handling to mutate only the target pane.
- [x] 5.4 Add activation hooks so pointerdown, focusin, contextmenu, wheel/gesture start, and drag/drop enter activate the source pane before input handling.
- [x] 5.5 Add lifecycle cleanup for text edit, drag, marquee, resize, rotation, pen, vector/node edit, and auto-layout padding edit on pane switch, page switch, pane close, and graph replacement following the design cleanup table.
- [x] 5.6 Implement first-slice text editing as pane-aware or explicitly active-pane guarded with commit/cancel semantics.
- [x] 5.7 Add tests for independent pan/zoom/selection/page switching and interaction cleanup.

## 6. Split Pane UI Components

- [x] 6.1 Add `CanvasSplitRoot` to host the per-document split tree and pane actions.
- [x] 6.2 Add recursive `CanvasSplitNode` using Reka `SplitterGroup`, `SplitterPanel`, and `SplitterResizeHandle`.
- [x] 6.3 Add `EditorCanvasPane` derived from current `EditorCanvas` with `paneId`, active-pane activation, pane render state, and pane-bound input.
- [x] 6.4 Replace direct `EditorCanvas` usages in desktop, mobile, collapsed, and bare layout branches with `CanvasSplitRoot`; keep mobile controls hidden and force/recover mobile to one visible pane in the first slice.
- [x] 6.5 Add split right, split down, and close pane actions with disabled states at cap and for last-pane close.
- [x] 6.6 Add an active pane visual indicator that does not steal canvas pointer input.
- [ ] 6.7 Add component tests for Reka splitter structure, stable panel order/IDs, layout size updates, split/close behavior, and active indicator.

## 7. Singleton Service Audit

- [x] 7.1 Classify keyboard/menu/command actions as document-wide or pane-sensitive.
- [x] 7.2 Update keyboard shortcuts and command handlers so pane-sensitive view, selection, nudge, clipboard, and tool interaction commands route through active pane.
- [x] 7.3 Update toolbar and zoom controls to display and mutate active pane state.
- [x] 7.4 Update page list and layer tree behavior to follow active pane page and selection.
- [x] 7.5 Update clipboard copy/cut/paste defaults to use active pane selection, cursor, and viewport center.
- [x] 7.6 Update export defaults and export property UI to use active pane selection or current page.
- [x] 7.7 Update automation/FigmaAPI and AI tool context to derive current page, selection, and viewport from active pane.
- [x] 7.8 Replace pane-sensitive first-canvas DOM queries and window-size viewport fallbacks with pane registry APIs.
- [x] 7.9 Add tests for singleton UI and command routing after activating different panes.

## 8. Collaboration and Presence

- [x] 8.1 Update local collaboration awareness to publish cursor, page, zoom, and selection from the active pane for the connected document.
- [x] 8.2 Keep raw remote peer data document-shared and derive visible remote cursors per pane page.
- [x] 8.3 Ensure pane switching within one connected document does not disconnect, reconnect, or recreate the collaboration room.
- [x] 8.4 Update follow-peer behavior to target the active pane or a documented follow pane without mutating inactive panes.
- [x] 8.5 Add tests for remote cursor filtering across panes with different pages and for pane switching while connected.

## 9. Verification and Cleanup

- [x] 9.1 Add unit tests for pane registry page deletion, graph replacement, active pane recovery, undo not corrupting inactive pane view state, and renderer disposal.
- [ ] 9.2 Add component coverage proving inactive panes render their own selection state while singleton UI follows the active pane.
- [ ] 9.3 Add Playwright coverage for split right/down, resize, independent pan/zoom, independent page switching, independent selection, active-pane properties, keyboard shortcut targeting, export defaults, and collaboration cursor projection.
- [x] 9.4 Remove temporary compatibility shims that are no longer needed after the first slice.
- [x] 9.5 Update `CHANGELOG.md` and user-facing docs if split panes are exposed in UI.
- [x] 9.6 Run `bun run check` and fix type/lint issues.
- [x] 9.7 Run `bun run format`.
- [x] 9.8 Run targeted unit/component tests for pane/split/canvas state.
- [ ] 9.9 Run targeted Playwright split-pane tests.
