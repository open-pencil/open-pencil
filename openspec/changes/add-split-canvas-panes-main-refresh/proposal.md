## Why

The previous split-pane branch diverged from a now much newer `origin/master`, so the one-document split canvas feature needs to be specified and rebuilt against the current main architecture instead of merged as-is. Users still need to inspect and edit different pages or regions of one document side by side while keeping document graph, undo, IO, autosave, and collaboration shared.

This proposal is grounded in the refreshed Evoton evidence pack `../../evoton/docs/studies/open-pencil-main-split-canvases-refresh/`, exported and review-ready against `origin/master` at `ec31ea11`. The study confirms that current main still has a single `EditorCanvas` host, global mixed document/view `EditorState`, no pane render-state hook, singleton command services, and existing multi-renderer lifecycle support.

## What Changes

- Add a per-document canvas pane registry with one shared document editor/store and multiple pane-local view states.
- Split view-local state out of global editor state ownership for pane-sensitive behavior: current page, selection, pan/zoom, viewport size, hover, cursor, remote cursor projection, and transient overlays.
- Keep document-wide state shared per document: graph, undo history, document IO/source state, autosave, active tool, loading, tabs, sidebars, toolbar, and collaboration room.
- Add a pane-bound editor facade used by canvas input, render, page/selection/viewport actions, and singleton UI defaults.
- Extend Vue canvas rendering to accept pane-specific render state and pane resize callbacks while preserving legacy single-canvas callers.
- Render recursive horizontal/vertical split panes in the central canvas area using Reka UI splitter primitives.
- Route singleton UI and commands through the active pane: properties, layers, page list, toolbar, zoom controls, keyboard/menu actions, clipboard defaults, export defaults, automation, and collaboration awareness rendering.
- Add lifecycle cleanup for long-running interactions when switching panes, closing panes, switching pages, or replacing the graph.
- Add an initial visible pane cap and tests for resource cleanup.

## Capabilities

### New Capabilities

- `split-canvas-panes-main-refresh`: Recursive canvas split panes within one document on current main, including pane-local view state, pane-aware render/input, active-pane singleton routing, collaboration projection, and resource guardrails.

### Modified Capabilities

- None. There are no archived baseline capabilities in this repository yet.

## Impact

- Core editor state and actions under `packages/core/src/editor/*`, especially state ownership, viewport, pages, selection, render counters, and lifecycle cleanup.
- Vue canvas SDK under `packages/vue/src/canvas/*`, including `useCanvas`, surface render loop/lifecycle, `useCanvasInput`, drop/text/pen/node-edit/transform inputs, and command composables.
- App editor session and store wrappers under `src/app/editor/session`, `src/app/editor/active-store`, and new pane modules under `src/app/editor/panes`.
- Central canvas components under `src/components`, replacing direct `EditorCanvas` hosts with split-pane components while keeping single-pane behavior compatible.
- Singleton services under keyboard/menu/clipboard/export/automation/collaboration/panels that currently resolve one active editor state.
- Tests for pane registry helpers, pane render state composition, split UI, active-pane routing, interaction cleanup, and E2E split workflows.
