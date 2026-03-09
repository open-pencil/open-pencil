## ADDED Requirements

### Requirement: Canvas manipulation E2E tests
The E2E suite SHALL include tests for `tests/e2e/canvas-manipulation.spec.ts` covering: marquee selection, resize handle drag, rotation handle drag, Alt+drag duplicate, Shift+Arrow nudge (10px), and hover highlight (visual screenshot comparison).

#### Scenario: Canvas manipulation tests pass
- **WHEN** `bun run test` executes `canvas-manipulation.spec.ts`
- **THEN** all 6+ tests pass verifying selection, resize, rotation, duplicate, nudge, and hover

### Requirement: Toolbar E2E tests
The E2E suite SHALL include tests for `tests/e2e/toolbar.spec.ts` covering: shapes flyout chevron, Polygon tool, Star tool, Pen tool (corner, close path, Escape), and Frame flyout.

#### Scenario: Toolbar tests pass
- **WHEN** `bun run test` executes `toolbar.spec.ts`
- **THEN** all 7+ tests pass verifying flyout menus and shape creation

### Requirement: Properties panel E2E tests
The E2E suite SHALL include tests for `tests/e2e/properties-panel.spec.ts` covering: ScrubInput drag, corner radius (uniform + independent), fill gradient switch, variable bind badge, alignment buttons, flip horizontal, and clip content checkbox.

#### Scenario: Properties panel tests pass
- **WHEN** `bun run test` executes `properties-panel.spec.ts`
- **THEN** all 8+ tests pass verifying property changes via store assertions

### Requirement: Text formatting E2E tests
The E2E suite SHALL include tests for `tests/e2e/text-formatting.spec.ts` covering: cursor positioning, double-click word select, ⌘B bold, ⌘I italic, Alt+ArrowRight word navigation, and Bold button in typography section.

#### Scenario: Text formatting tests pass
- **WHEN** `bun run test` executes `text-formatting.spec.ts`
- **THEN** all 6+ tests pass verifying text edit interactions

### Requirement: Auto-layout E2E tests
The E2E suite SHALL include tests for `tests/e2e/auto-layout.spec.ts` covering: Shift+A on selection, direction toggle, gap ScrubInput, uniform padding, alignment grid, and remove auto-layout.

#### Scenario: Auto-layout tests pass
- **WHEN** `bun run test` executes `auto-layout.spec.ts`
- **THEN** all 6+ tests pass verifying auto-layout frame state via store

### Requirement: Snap guides E2E tests
The E2E suite SHALL include tests for `tests/e2e/snap-guides.spec.ts` covering: edge snap guide and center snap guide, both verified via screenshot comparison.

#### Scenario: Snap guide tests pass
- **WHEN** `bun run test` executes `snap-guides.spec.ts`
- **THEN** 2 screenshot comparison tests pass confirming guide line visibility

### Requirement: Panel resize E2E tests
The E2E suite SHALL include tests for `tests/e2e/panels.spec.ts` covering: left panel drag resize, width persistence after reload, and ⌘\\ UI toggle (hide + show).

#### Scenario: Panel tests pass
- **WHEN** `bun run test` executes `panels.spec.ts`
- **THEN** all 4+ tests pass verifying panel DOM dimensions and visibility

### Requirement: Variables dialog E2E tests
The E2E suite SHALL include tests for `tests/e2e/variables-dialog.spec.ts` covering: dialog open, search filter, cell edit, and color swatch picker.

#### Scenario: Variables dialog tests pass
- **WHEN** `bun run test` executes `variables-dialog.spec.ts`
- **THEN** all 4+ tests pass verifying dialog interactions

### Requirement: Export E2E tests
The E2E suite SHALL include tests for `tests/e2e/export.spec.ts` covering: format selector, add/remove rows, preview toggle, and SVG hiding scale input.

#### Scenario: Export tests pass
- **WHEN** `bun run test` executes `export.spec.ts`
- **THEN** all 5+ tests pass verifying export section UI state

### Requirement: CanvasHelper extended helpers
The `CanvasHelper` class SHALL provide `marquee()`, `hover()`, `dragScrubInput()`, and `shiftDrag()` helper methods usable across all spec files.

#### Scenario: Helpers available in all specs
- **WHEN** a spec file imports `CanvasHelper`
- **THEN** `canvas.marquee()`, `canvas.hover()`, `canvas.dragScrubInput()`, and `canvas.shiftDrag()` are callable without TypeScript errors
