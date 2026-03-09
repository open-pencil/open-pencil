## Context

The project has 17 Playwright E2E spec files covering ~140 test cases, but 12 of 20 manual test plan sections are sparsely covered. All existing tests share a common pattern: `window.__OPEN_PENCIL_STORE__` for state assertions, `CanvasHelper` for canvas interactions, `test.describe.configure({ mode: 'serial' })` with a shared page per file, and page-level event forwarding for error tracking. New tests follow the same conventions.

## Goals / Non-Goals

**Goals:**
- Cover every gap identified in the 20-section manual test plan
- Use `window.__OPEN_PENCIL_STORE__` for deterministic state assertions (no pixel-matching for non-visual tests)
- Keep each spec file self-contained: `beforeAll` creates a fresh page, draws needed fixtures, `afterAll` closes
- Use `canvas.waitForRender()` after every interaction, never arbitrary `waitForTimeout`
- Tests that need visual confirmation (snap guides, hover highlight) use `toHaveScreenshot` with existing snapshot infra

**Non-Goals:**
- Cross-browser testing (Chromium only, matching existing suite)
- Collaboration/P2P tests (require two browser instances and signaling — separate effort)
- Export file content validation (OS dialog interception is too brittle; test UI state only)
- Font picker rendering (system fonts vary across CI environments)

## Decisions

**1. CanvasHelper extension over ad-hoc helpers**
Add `marquee()`, `hover()`, `dragScrubInput()`, and `shiftDrag()` to the existing `CanvasHelper` class. Alternative: inline helpers per test file. Rejected because inline helpers duplicate boilerplate and drift from each other.

**2. Store assertions for invisible/locked nodes**
Nodes that are invisible or locked cannot be hit-tested on canvas. Use `page.evaluate(() => window.__OPEN_PENCIL_STORE__!.graph.getNode(id))` to assert state directly. Consistent with how `context-menu.spec.ts` already handles visibility toggle.

**3. Snap guide tests use screenshot comparison**
Snap guide lines are rendered on the canvas (CanvasKit), not DOM. The only way to assert their presence is `toHaveScreenshot`. Use `--update-snapshots` once on a known-good run; CI then catches regressions. Alternative: expose a `debugSnapLines` store getter — rejected as production API pollution.

**4. ScrubInput drag via `mouse.move` with delta**
ScrubInput responds to `pointerdown` + `pointermove` on the outer container. Simulate with `page.mouse.move(x, y)` → `page.mouse.down()` → `page.mouse.move(x + delta, y)` → `page.mouse.up()`. A `dragScrubInput(locator, delta)` helper encapsulates this.

**5. Variables dialog accessed via store page.evaluate**
The dialog can be opened by clicking the settings icon in `VariablesSection` (only visible without selection). Rather than pixel-hunting for the icon, use `page.locator('[data-test-id="variables-settings-btn"]')`. If that attribute doesn't exist, fall back to `page.evaluate(() => window.__OPEN_PENCIL_STORE__!.openVariablesDialog())` — check during implementation.

**6. Export tests assert UI state, not file content**
`showSaveFilePicker` is a native dialog; Playwright cannot intercept it in Chrome without mocking. Tests verify: export rows are added/removed, preview image appears, format selector value changes. No file download assertion.

## Risks / Trade-offs

- [ScrubInput pointer simulation] → ScrubInput uses `setPointerCapture` which may not behave identically in headless Chromium. Mitigation: test with `--enable-unsafe-swiftshader` (already in playwright.config.ts).
- [Snap guide snapshots] → Guide rendering depends on node positions set up in `beforeAll`. If canvas DPI/viewport changes, snapshots break. Mitigation: pin `deviceScaleFactor: 2` and `viewport: 1280×800` (already in config).
- [Variables dialog test-id] → `data-test-id` may not exist on the settings button. Mitigation: check during implementation; add attribute if missing (1-line change in `VariablesSection.vue`).
- [Font picker test] → Excluded from scope due to CI font availability variance.
