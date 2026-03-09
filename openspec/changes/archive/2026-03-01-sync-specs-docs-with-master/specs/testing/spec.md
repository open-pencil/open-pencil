## ADDED Requirements

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
