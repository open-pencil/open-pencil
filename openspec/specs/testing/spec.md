# testing Specification

## Purpose
Test infrastructure. Playwright visual regression (E2E with Figma CDP reference), bun:test unit tests, no-chrome test mode, data-ready synchronization, and page reuse optimization.
## Requirements
### Requirement: Playwright visual regression testing
E2E tests SHALL use Playwright to create shapes and compare screenshots against baseline snapshots.

#### Scenario: Visual regression test pass
- **WHEN** `bun run test` is executed
- **THEN** Playwright tests create shapes, take screenshots, and compare against baseline PNGs

### Requirement: Figma CDP reference tests
A separate Playwright project SHALL connect to Figma via Chrome DevTools Protocol (CDP) to capture reference screenshots for pixel-perfect comparison.

#### Scenario: Figma reference capture
- **WHEN** `bun run test:figma` is executed with Figma running in debug mode
- **THEN** Playwright connects to Figma via CDP and captures reference screenshots

### Requirement: No-chrome test mode
The editor SHALL support a test mode (activated via URL param or environment) that hides Chrome/UI elements for clean screenshot capture.

#### Scenario: Test mode rendering
- **WHEN** the editor loads in test mode
- **THEN** only canvas content is rendered, without toolbar, panels, or other UI chrome

### Requirement: Data-ready optimization
The editor SHALL signal readiness via a `data-ready` attribute for E2E test synchronization, replacing unreliable timeouts.

#### Scenario: Wait for ready
- **WHEN** a Playwright test waits for the data-ready attribute
- **THEN** it proceeds only when the canvas is fully rendered

### Requirement: Page reuse for speed
E2E tests SHALL reuse the browser page across test cases to minimize overhead. Target: all E2E tests complete in <3s.

#### Scenario: Fast E2E execution
- **WHEN** the full E2E test suite runs
- **THEN** it completes in under 3 seconds by reusing the page

### Requirement: bun:test unit tests
Engine unit tests SHALL use bun:test and complete in <50ms.

#### Scenario: Unit test speed
- **WHEN** `bun test ./tests/engine` is run
- **THEN** all unit tests pass in under 50ms

### Requirement: Fig-import unit tests
Unit tests SHALL verify the .fig import pipeline: node type mapping, transform extraction, fill/stroke/effect import, gradient stops, image fills, arc data, stroke properties, and nested frame hierarchies.

#### Scenario: Run fig-import tests
- **WHEN** `bun test ./tests/engine/fig-import.test.ts` is executed
- **THEN** all import pipeline tests pass covering tier 1 rendering features

### Requirement: Layout unit tests
Unit tests SHALL verify Yoga auto-layout computation: direction, gap, padding, justify, align, child sizing (fixed/fill/hug), cross-axis sizing, wrap, and nested layouts.

#### Scenario: Run layout tests
- **WHEN** `bun test ./tests/engine/layout.test.ts` is executed
- **THEN** all layout computation tests pass

### Requirement: Layers panel E2E tests
E2E tests SHALL verify the layers panel: node visibility in tree, expand/collapse frames, selection sync between canvas and layers panel. Test fixtures match current demo shapes (Components, App Preview).

#### Scenario: Run layers panel E2E
- **WHEN** the layers panel E2E tests run
- **THEN** all tests pass verifying tree structure, visibility toggles, and selection sync with updated demo shape names

### Requirement: Component-instance sync unit tests
Unit tests SHALL cover the component-instance sync lifecycle: instance creation with `componentId` mapping on children, sync propagation of property changes, override preservation during sync, new child addition to instances, and detach breaking the link.

#### Scenario: Instance child mapping test
- **WHEN** `bun test ./tests/engine/scene-graph.test.ts` runs
- **THEN** the test verifies instance children have `componentId` pointing to component children

#### Scenario: Sync propagation test
- **WHEN** a component's text child changes and sync is triggered
- **THEN** the test verifies instance children receive the updated text and fontSize

#### Scenario: Override preservation test
- **WHEN** an instance child has an overridden text value
- **THEN** the test verifies the override is preserved while non-overridden properties sync

#### Scenario: New child addition test
- **WHEN** a new child is added to a component and sync runs
- **THEN** the test verifies existing instances gain the new child

#### Scenario: Detach test
- **WHEN** an instance is detached
- **THEN** the test verifies type becomes FRAME, componentId is null, and the component's instance list no longer includes it

### Requirement: Variable system unit tests
Unit tests SHALL cover the variables system: add and resolve color/number variables, alias chain resolution, circular alias detection (returns undefined), mode switching, bind/unbind to nodes, and variable removal cleanup. Total: 7 variable tests in a "Variables" describe block.

#### Scenario: Variable tests pass
- **WHEN** `bun test ./tests/engine` is run
- **THEN** all variable tests pass (add/resolve color, resolve number, alias chain, circular alias, mode switching, bind/unbind, removal cleanup)

### Requirement: .fig roundtrip tests
The test suite SHALL include roundtrip tests for real .fig files: parsing property invariants, encode/decode cycle fidelity. Test fixtures (material3.fig, nuxtui.fig) SHALL be tracked via Git LFS.

#### Scenario: Roundtrip encode/decode
- **WHEN** a .fig file is parsed and re-encoded
- **THEN** the re-encoded data decodes to the same node properties

#### Scenario: Property invariants
- **WHEN** a real .fig file is parsed
- **THEN** all nodes have valid types, dimensions ≥ 0, and required fields present

### Requirement: .fig import performance
The .fig import pipeline SHALL avoid O(n²) child resolution. A children index SHALL be built upfront for linear-time lookups.

#### Scenario: Large file import speed
- **WHEN** material3.fig (87K nodes) is imported
- **THEN** parsing completes in under 2 seconds (was 37s before fix)

### Requirement: JSX renderer tests
The test suite SHALL include tests for the JSX renderer covering all node types (Frame, Text, Rectangle, Ellipse, etc.), layout props, effects, and nesting. Currently 27 tests.

#### Scenario: Render Frame with children
- **WHEN** a JSX tree with Frame containing Rectangle and Text is rendered
- **THEN** the scene graph contains correct parent-child relationships and properties

### Requirement: AI chat Playwright tests
The test suite SHALL include Playwright e2e tests for the AI chat panel with mock transport (no real LLM calls). Tests cover: sending a message, receiving a response, tool call display. Real LLM tests available via TEST_REAL_LLM=1 flag.

#### Scenario: Chat with mock transport
- **WHEN** a Playwright test sends a message via the chat input
- **THEN** the mock transport returns a response and the message appears in the chat

### Requirement: JSX export tests
The test suite SHALL include tests for sceneNodeToJsx() covering shapes, text, layout props, effects, and multi-selection. Currently 14 tests.

#### Scenario: Export rectangle to JSX
- **WHEN** sceneNodeToJsx is called on a rectangle with blue fill
- **THEN** the output includes Rectangle component with bg prop


### Requirement: FigmaAPI unit tests

The project SHALL provide comprehensive unit tests for the Figma Plugin API in `tests/engine/figma-api.test.ts`.

#### Scenario: Node creation tests
- **WHEN** `bun test tests/engine/figma-api.test.ts` runs
- **THEN** tests verify `createFrame()`, `createRectangle()`, `createText()`, and other creation methods

#### Scenario: Property access tests
- **WHEN** tests read node properties (x, y, width, height, name, fills, strokes)
- **THEN** all getters return correct values from SceneNode

#### Scenario: Property setting tests
- **WHEN** tests set node properties (`node.name = "Test"`, `node.x = 100`)
- **THEN** SceneGraph is updated correctly

#### Scenario: Text property tests
- **WHEN** tests access `textNode.characters`, `fontSize`, `fontName`
- **THEN** text-specific properties work correctly

#### Scenario: Auto-layout tests
- **WHEN** tests set `layoutMode = "VERTICAL"`, `itemSpacing`, `paddingLeft`
- **THEN** auto-layout properties are applied

#### Scenario: Tree operation tests
- **WHEN** tests call `appendChild()`, `insertChild()`, `remove()`
- **THEN** scene graph tree is modified correctly

#### Scenario: Traversal tests
- **WHEN** tests call `findAll()`, `findOne()`, `findAllWithCriteria()`
- **THEN** correct nodes are returned

#### Scenario: Component tests
- **WHEN** tests create components and instances
- **THEN** component-instance relationships work

#### Scenario: Serialization tests
- **WHEN** tests call `figma.toJSON(node)`
- **THEN** JSON output includes all required properties

#### Scenario: Frozen array tests
- **WHEN** tests access `fills`, `strokes`, `children` and try to mutate
- **THEN** arrays are frozen and throw errors on mutation attempts

#### Scenario: 924 LOC of tests
- **WHEN** FigmaAPI test file is counted
- **THEN** it contains 924 lines covering 60+ test cases

### Requirement: Eval CLI integration tests

The project SHALL provide integration tests for eval command in `tests/engine/eval-cli.test.ts`.

#### Scenario: Inline code execution test
- **WHEN** test runs eval with `--code 'return figma.currentPage.id'`
- **THEN** output matches expected page ID

#### Scenario: Node creation test
- **WHEN** test runs eval creating a frame
- **THEN** document is modified and frame exists

#### Scenario: Write flag test
- **WHEN** test runs eval with `--write`
- **THEN** file is modified in-place

#### Scenario: Output file test
- **WHEN** test runs eval with `-o output.fig`
- **THEN** new file is created with modifications

#### Scenario: JSON output test
- **WHEN** test runs eval with `--json`
- **THEN** result is formatted as JSON

#### Scenario: Error handling test
- **WHEN** eval code throws error
- **THEN** stderr contains error message

#### Scenario: 202 LOC of integration tests
- **WHEN** eval CLI test file is counted
- **THEN** it contains 202 lines covering 17 integration scenarios

### Requirement: Tool schema unit tests

The project SHALL provide unit tests for unified tool definitions in `tests/engine/tools.test.ts`.

#### Scenario: Schema structure tests
- **WHEN** tests validate tool schemas
- **THEN** each tool has name, description, parameters, and handler

#### Scenario: Tool handler tests
- **WHEN** tests invoke tool handlers with valid params
- **THEN** handlers return expected results

#### Scenario: Parameter validation tests
- **WHEN** tests call handlers with invalid params
- **THEN** errors are raised or handled gracefully

#### Scenario: 390 LOC of tool tests
- **WHEN** tools test file is counted
- **THEN** it contains 390 lines

### Requirement: Tool adapter tests

The project SHALL provide adapter tests in `tests/engine/tools-ai-adapter.test.ts` (190 LOC) and `tests/engine/tools-cli.test.ts` (219 LOC).

#### Scenario: AI adapter format test
- **WHEN** AI adapter converts schema to LLM format
- **THEN** output matches expected structure

#### Scenario: CLI adapter test
- **WHEN** CLI commands use tool schema
- **THEN** parameters map correctly

### Requirement: App menu integration tests

The project SHALL provide integration tests for app menu in `tests/e2e/app-menu.spec.ts`.

#### Scenario: File menu test
- **WHEN** test clicks File menu items
- **THEN** actions (Open, Save, Export) are triggered

#### Scenario: Edit menu test
- **WHEN** test uses Edit menu (Undo, Redo, Copy, Paste)
- **THEN** operations execute correctly

#### Scenario: View menu test
- **WHEN** test uses View → Zoom in/out
- **THEN** viewport zoom changes

#### Scenario: Object menu test
- **WHEN** test uses Object → Group/Ungroup
- **THEN** nodes are grouped/ungrouped

#### Scenario: Text menu test
- **WHEN** test uses Text → Bold/Italic
- **THEN** text styles are applied

#### Scenario: Arrange menu test
- **WHEN** test uses Arrange → Bring to front
- **THEN** z-order changes

#### Scenario: 131 LOC of app menu tests
- **WHEN** app menu test file is counted
- **THEN** it contains 131 lines

### Requirement: Autosave integration tests

The project SHALL provide integration tests for autosave in `tests/e2e/autosave.spec.ts`.

#### Scenario: Autosave trigger test
- **WHEN** test modifies scene graph
- **THEN** autosave timer starts

#### Scenario: Debounce test
- **WHEN** test makes rapid changes
- **THEN** only one save occurs after 3 seconds

#### Scenario: Write test
- **WHEN** autosave timer expires
- **THEN** file is written

#### Scenario: Skip unchanged test
- **WHEN** sceneVersion matches savedVersion
- **THEN** write is skipped

#### Scenario: 113 LOC of autosave tests
- **WHEN** autosave test file is counted
- **THEN** it contains 113 lines

### Requirement: Test coverage expansion

The test suite SHALL expand from original coverage to include 2571 LOC of new tests across 7 files (figma-api.test.ts, eval-cli.test.ts, tools.test.ts, tools-ai-adapter.test.ts, tools-cli.test.ts, app-menu.spec.ts, autosave.spec.ts).

#### Scenario: Total new test lines
- **WHEN** new test files are counted
- **THEN** 2571 lines of tests are added

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

