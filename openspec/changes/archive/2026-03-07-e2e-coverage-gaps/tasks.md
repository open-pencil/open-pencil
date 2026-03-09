# Tasks: e2e-coverage-gaps

## 0. Prerequisites — data-test-id audit

- [x] 0.1 Add `data-test-id="corner-radius-input"` to the uniform corner radius ScrubInput in `AppearanceSection.vue`
- [x] 0.2 Add `data-test-id="independent-corners-toggle"` to the independent corners toggle button in `AppearanceSection.vue`
- [x] 0.3 Add `data-test-id="corner-tl-input"`, `corner-tr-input`, `corner-br-input`, `corner-bl-input` to the four independent corner ScrubInputs in `AppearanceSection.vue`
- [x] 0.4 Add `data-test-id="clip-content-checkbox"` to the clip content checkbox in `LayoutSection.vue`
- [x] 0.5 Add `data-test-id="left-splitter-handle"` to the first `SplitterResizeHandle` in `EditorView.vue`
- [x] 0.6 Add `data-test-id="typography-bold-button"` to the Bold button in `TypographySection.vue`
- [x] 0.7 Add `data-test-id="variables-search-input"` to the search input in `VariablesDialog.vue`

## 1. Extend CanvasHelper

- [x] 1.1 Add `marquee(x1, y1, x2, y2, steps = 10)` method to `tests/helpers/canvas.ts` — mouse.move to start → mouse.down → mouse.move to end with steps → mouse.up, then waitForRender
- [x] 1.2 Add `hover(x, y)` method — mouse.move to canvas-relative position, waitForRender (uses existing `waitForRender`)
- [x] 1.3 Add `dragScrubInput(locator, deltaX)` method — scroll element into view, getBoundingBox, mouse.move to center, mouse.down, mouse.move +deltaX, mouse.up
- [x] 1.4 Add `altDrag(fromX, fromY, toX, toY)` method — keyboard.down('Alt') → drag → keyboard.up('Alt'), then waitForRender

## 2. Canvas Manipulation spec

- [x] 2.1 Create `tests/e2e/canvas-manipulation.spec.ts` with serial describe, shared page/CanvasHelper, beforeAll (goto + waitForInit + clearCanvas), afterAll (close)
- [x] 2.2 Test: marquee selects two rectangles — draw rect at (100,100,80,80), draw rect at (250,100,80,80), marquee from (80,80) to (360,220), assert `store.state.selectedIds.size === 2`
- [x] 2.3 Test: marquee on empty area deselects — press Escape to select none, draw rect at (100,300,80,80), click to select it, marquee from (500,500) to (600,600), assert `store.state.selectedIds.size === 0`
- [x] 2.4 Test: Alt+drag duplicate — clearCanvas, draw rect at (100,100,80,80), click to select, altDrag from (140,140) to (280,140), assert page child count increased by 1
- [x] 2.5 Test: Shift+ArrowRight nudge 10px — clearCanvas, draw rect at (200,200,80,80), record `node.x`, press Shift+ArrowRight, assert `node.x === initial + 10`
- [x] 2.6 Test: hover highlight visual — clearCanvas, draw rect at (200,200,100,100), take no-hover screenshot, `canvas.hover(250, 250)`, take hover screenshot, assert they differ using `expect(hoverShot).not.toEqual(noHoverShot)` (Buffer comparison, not toHaveScreenshot — avoids baseline management)

## 3. Toolbar spec

- [x] 3.1 Create `tests/e2e/toolbar.spec.ts` with serial describe, shared page/CanvasHelper, beforeAll (goto + waitForInit)
- [x] 3.2 Test: shapes flyout opens — click `[data-test-id="toolbar-flyout-rectangle"]`, assert `[data-test-id="toolbar-flyout-item-polygon"]` is visible
- [x] 3.3 Test: Polygon created — click `[data-test-id="toolbar-flyout-item-polygon"]`, drag on canvas (300,200) to (400,300), assert POLYGON node in store page children
- [x] 3.4 Test: Star created — click `[data-test-id="toolbar-flyout-rectangle"]`, click `[data-test-id="toolbar-flyout-item-star"]`, drag (150,150) to (250,250), assert STAR node in store page children
- [x] 3.5 Test: Pen creates VECTOR on Enter — press P, click canvas at (100,100), click at (200,100), click at (200,200), press Enter (commits open path), assert VECTOR node with `vectorNetwork.vertices.length === 3`
- [x] 3.6 Test: Frame flyout shows Frame and Section — click `[data-test-id="toolbar-flyout-frame"]`, assert `[data-test-id="toolbar-flyout-item-frame"]` and `[data-test-id="toolbar-flyout-item-section"]` are both visible

## 4. Properties Panel spec

- [x] 4.1 Create `tests/e2e/properties-panel.spec.ts` with serial describe, shared page/CanvasHelper, beforeAll (goto + waitForInit)
- [x] 4.2 Test: ScrubInput drag changes X — clearCanvas, draw rect at (100,100,80,80), record `node.x`, dragScrubInput(`[data-test-id="position-section"] input` first scrub, +50), assert `node.x` changed from initial
- [x] 4.3 Test: corner radius uniform — clearCanvas, draw rect at (200,200,80,80), select, triple-click `[data-test-id="corner-radius-input"]` input, type "12", press Enter, assert `node.cornerRadius === 12`
- [x] 4.4 Test: independent corners shows four fields — click `[data-test-id="independent-corners-toggle"]`, assert `[data-test-id="corner-tl-input"]`, `corner-tr-input`, `corner-br-input`, `corner-bl-input` are all visible
- [x] 4.5 Test: fill gradient switch — clearCanvas, draw rect at (200,200,80,80), click `[data-test-id="fill-item"]` swatch to open picker, click `[data-test-id="fill-picker-tab-gradient"]`, assert `node.fills[0].type === 'GRADIENT_LINEAR'`
- [x] 4.6 Test: alignment buttons align nodes — clearCanvas, draw rect at (50,200,60,60), draw rect at (250,200,60,60), select both (Meta+A), click `[data-test-id="position-align-left"]`, assert both nodes have same `node.x`
- [x] 4.7 Test: flip horizontal — clearCanvas, draw rect at (200,200,80,80), click `[data-test-id="position-flip-horizontal"]`, assert `node.flipX === true`
- [x] 4.8 Test: clip content checkbox — clearCanvas, press F, drag (100,100) to (300,300) to create frame, select it, click `[data-test-id="clip-content-checkbox"]`, assert `node.clipsContent` changed

## 5. Text Formatting spec

- [x] 5.1 Create `tests/e2e/text-formatting.spec.ts` with serial describe, shared page/CanvasHelper, beforeAll (goto + waitForInit)
- [x] 5.2 Test: double-click enters text edit mode — create text node via store at (200,200,150,30), press Escape to deselect, double-click canvas at (275,215), waitForRender, assert `store.state.editingTextId` is not null, assert no canvas errors
- [x] 5.3 Test: Cmd+B toggles bold — (continuing from text edit mode) Ctrl+A, Meta+b, press Escape, assert `node.fontWeight === 700`
- [x] 5.4 Test: Cmd+I toggles italic — double-click text node to re-enter edit, Ctrl+A, Meta+i, press Escape, assert `node.italic === true`
- [x] 5.5 Test: Alt+ArrowRight word navigation — double-click text node to enter edit, press Alt+ArrowRight, assert no canvas errors, assert `store.state.editingTextId` is still set
- [x] 5.6 Test: Bold button in panel — press Escape to exit edit mode and stay selected, click `[data-test-id="typography-bold-button"]`, assert `node.fontWeight` changed

## 6. Auto-Layout spec

- [x] 6.1 Create `tests/e2e/auto-layout.spec.ts` with serial describe, shared page/CanvasHelper, beforeAll (goto + waitForInit + clearCanvas)
- [x] 6.2 Test: Shift+A wraps selection — draw rect at (100,100,60,60), draw rect at (220,100,60,60), Meta+A, Shift+A, assert FRAME node with `layoutMode !== 'NONE'` and 2 children
- [x] 6.3 Test: direction button toggles VERTICAL — select the auto-layout frame, click `[data-test-id="layout-direction-vertical"]`, assert `frame.layoutMode === 'VERTICAL'`
- [x] 6.4 Test: gap ScrubInput sets itemSpacing — select frame, dragScrubInput(`[data-test-id="layout-section"]` gap scrub input, +20), assert `frame.itemSpacing >= 20`
- [x] 6.5 Test: alignment grid center — select frame, click 5th button (index 4) inside `[data-test-id="layout-alignment-grid"]`, assert `frame.primaryAxisAlign === 'CENTER'` and `frame.counterAxisAlign === 'CENTER'`
- [x] 6.6 Test: remove auto-layout — select frame, click `[data-test-id="layout-remove-auto"]`, assert `frame.layoutMode === 'NONE'`

## 7. Snap Guides spec

- [x] 7.1 Create `tests/e2e/snap-guides.spec.ts` with serial describe, shared page/CanvasHelper, beforeAll (goto + waitForInit + clearCanvas). Tag with `test.skip` on Linux CI (snap guides are visual-only and X11 Alt+drag interference makes setup unreliable; these are run manually or on macOS CI).
- [x] 7.2 Test: edge snap guide visual — create rect A at (100,100,80,80) and rect B at (300,100,80,80) via store. Take baseline screenshot. Slow-drag rect B from (340,140) toward (182,140) with steps=30 using mouse.down/move (do NOT release). Take mid-drag screenshot. Assert screenshots differ (guide pixels appeared). Release mouse.
- [x] 7.3 Test: center snap guide visual — reset rects, slow-drag rect B toward center alignment with rect A with steps=30 mid-drag. Assert screenshots differ.

## 8. Panels spec

- [x] 8.1 Create `tests/e2e/panels.spec.ts` with serial describe, shared page/CanvasHelper, beforeAll (goto + waitForInit)
- [x] 8.2 Test: layers panel resize — get bounding box of `[data-test-id="layers-panel"]`, record width, drag `[data-test-id="left-splitter-handle"]` 80px right, assert panel width increased by at least 40px
- [x] 8.3 Test: panel width persists after reload — record panel width after resize, reload page, waitForInit, assert new panel width is within 5px of recorded width (Reka SplitterGroup uses `auto-save-id` localStorage)
- [x] 8.4 Test: Cmd+Backslash hides panels — press Meta+Backslash, assert `[data-test-id="layers-panel"]` not visible
- [x] 8.5 Test: Cmd+Backslash shows panels — press Meta+Backslash again, assert layers-panel visible

## 9. Variables Dialog spec

- [x] 9.1 Create `tests/e2e/variables-dialog.spec.ts` with serial describe, shared page/CanvasHelper, beforeAll (goto + waitForInit)
- [x] 9.2 Test: dialog opens — create a color variable collection via `store.graph` evaluate, click `[data-test-id="variables-section-open"]`, assert `[data-test-id="variables-dialog"]` is visible
- [x] 9.3 Test: search filters rows — create 2 variables with names "alpha-color" and "beta-spacing" via store, type "alpha" into `[data-test-id="variables-search-input"]`, assert only 1 `tr` row visible in the table body
- [x] 9.4 Test: click cell to edit — click the EditablePreview in the first name cell, assert EditableInput is focused (use `page.locator('[data-test-id="variables-dialog"] tbody tr:first-child [contenteditable], input').first()`)
- [x] 9.5 Test: color swatch opens picker — click `[data-test-id="color-picker-swatch"]` in first color variable row, assert `[data-test-id="color-picker-popover"]` is visible

## 10. Export spec

- [x] 10.1 Create `tests/e2e/export.spec.ts` with serial describe, shared page/CanvasHelper, beforeAll (goto + waitForInit + drawRect + select)
- [x] 10.2 Test: add export row — count `[data-test-id="export-item"]`, click `[data-test-id="export-section-add"]`, assert count +1
- [x] 10.3 Test: remove export row — click add again (now 2 rows), click `[data-test-id="export-item"]:first-child button` (the − button), assert count back to 1
- [x] 10.4 Test: format selector changes to JPG — click the format AppSelect in the export row, select "JPG", assert AppSelect displays "JPG"
- [x] 10.5 Test: SVG hides scale input — change format to SVG, assert the scale AppSelect is not visible (ExportSection hides scale for SVG via `v-if="setting.format !== 'SVG'"`)
- [x] 10.6 Test: preview toggle shows image — click `[data-test-id="export-preview-toggle"]`, wait for `[data-test-id="export-section"] img` to be visible, assert `img.src` starts with `blob:` (confirms actual render, not empty src)
