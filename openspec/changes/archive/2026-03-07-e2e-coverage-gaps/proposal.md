## Why

The existing E2E suite covers core happy paths but leaves 12 of 20 manual test plan sections with significant uncovered scenarios. Gaps include canvas manipulation (marquee select, resize handles, rotation, Space+drag pan), toolbar flyouts (Polygon/Star/Pen drawing), properties panel interactions (ScrubInput drag, corner radius, gradient, variable binding, alignment), text editing (cursor positioning, formatting shortcuts, font picker), auto-layout controls (direction, gap, padding, alignment grid), snap guides, panel resizing, variables dialog, export, and collaboration UI.

## What Changes

- Add `tests/e2e/canvas-manipulation.spec.ts` — marquee select, resize handles, rotation, Alt+drag duplicate, Shift+Arrow nudge, hover highlight
- Add `tests/e2e/toolbar.spec.ts` — flyout chevrons, Polygon, Star tools, Pen drawing (corner, curve, close, Escape, preview), active tracking
- Add `tests/e2e/properties-panel.spec.ts` — ScrubInput drag-to-change, corner radius (uniform + independent), fill gradient, variable bind/unbind, flip/rotate buttons, alignment buttons, clip content
- Add `tests/e2e/text-formatting.spec.ts` — cursor positioning, drag select, word/line select, word/line navigation shortcuts, bold/italic/underline via keyboard and buttons, font picker search
- Add `tests/e2e/auto-layout.spec.ts` — Shift+A on selection, direction toggle (H/V/wrap), gap ScrubInput, padding (uniform + per-side), alignment grid 3×3, sizing modes
- Add `tests/e2e/snap-guides.spec.ts` — edge snap, center snap (visual: guide lines appear during drag)
- Add `tests/e2e/panels.spec.ts` — layers panel resize, panel size after reload, ⌘\ toggle UI
- Add `tests/e2e/variables-dialog.spec.ts` — open dialog, search filter, edit value, color variable picker
- Add `tests/e2e/export.spec.ts` — PNG/JPG/WEBP/SVG export settings, multi-export rows, preview toggle
- Extend `tests/helpers/canvas.ts` — add `marquee()`, `hover()`, `rightDrag()`, `dragScrubInput()` helpers

## Capabilities

### New Capabilities
- `e2e-canvas-manipulation`: E2E tests for marquee selection, resize, rotation, duplicate, nudge, hover highlight
- `e2e-toolbar`: E2E tests for toolbar flyouts and Pen tool drawing flows
- `e2e-properties-panel`: E2E tests for ScrubInput drag, corner radius, gradient, variable binding, panel interactions
- `e2e-text-formatting`: E2E tests for text cursor, selection, formatting shortcuts and buttons
- `e2e-auto-layout`: E2E tests for auto-layout controls: direction, gap, padding, alignment grid, sizing
- `e2e-snap-guides`: E2E tests for snap guide visibility during drag
- `e2e-panels`: E2E tests for resizable panels and UI toggle
- `e2e-variables-dialog`: E2E tests for variables dialog open, search, edit, color picker
- `e2e-export`: E2E tests for export format settings and preview

### Modified Capabilities
- `testing`: Add new E2E requirements for all 9 new spec files and CanvasHelper extension

## Impact

- `tests/e2e/` — 9 new spec files (~1800 lines)
- `tests/helpers/canvas.ts` — 4 new helper methods
- No production code changes
- All tests target `http://localhost:1420` with `window.__OPEN_PENCIL_STORE__` for state assertions
