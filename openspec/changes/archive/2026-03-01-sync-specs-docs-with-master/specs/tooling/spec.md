## ADDED Requirements

### Requirement: Unified tool definitions

The project SHALL define design tools once in `packages/core/src/tools/` and adapt them for AI, CLI, and MCP contexts.

#### Scenario: Canonical tool schema
- **WHEN** a new tool is added
- **THEN** it is defined in `packages/core/src/tools/schema.ts` as the single source of truth

#### Scenario: AI adapter
- **WHEN** AI assistant needs tool definitions
- **THEN** `packages/core/src/tools/ai-adapter.ts` converts schema to LLM-compatible format

#### Scenario: CLI adapter
- **WHEN** CLI commands use tools
- **THEN** citty commands consume tool schema directly

#### Scenario: MCP adapter (future)
- **WHEN** MCP server integration is added
- **THEN** MCP protocol adapter converts tool schema to MCP format

### Requirement: Tool schema structure

Tool schemas SHALL be defined in `packages/core/src/tools/schema.ts` with name, description, parameters (with types and descriptions), and handler function.

#### Scenario: Tool definition format
- **WHEN** defining a tool in schema.ts
- **THEN** structure includes `{ name, description, parameters: { <param>: { type, description } }, handler: (params) => result }`

#### Scenario: Type-safe parameters
- **WHEN** tool is invoked
- **THEN** parameters are validated against schema types

### Requirement: Deduplication of AI tools

The project SHALL eliminate duplication in `src/ai/tools.ts` by using `FigmaAPI.toJSON()` for node serialization and shared color parsing from `packages/core/src`.

#### Scenario: Node serialization
- **WHEN** AI tool returns node data
- **THEN** it uses `figmaAPI.toJSON(node)` instead of custom JSON builders

#### Scenario: Color parsing
- **WHEN** AI tool parses color input
- **THEN** it uses `parseColor()` from core instead of inline regex

#### Scenario: Code reduction
- **WHEN** AI tools are refactored
- **THEN** 311 lines are removed from `src/ai/tools.ts` via deduplication

### Requirement: Shared tool testing

The project SHALL provide test suites for tools in `tests/engine/tools.test.ts`, `tests/engine/tools-ai-adapter.test.ts`, and `tests/engine/tools-cli.test.ts`.

#### Scenario: Tool schema tests
- **WHEN** `tests/engine/tools.test.ts` runs
- **THEN** each tool schema is validated for structure and handler execution

#### Scenario: AI adapter tests
- **WHEN** `tests/engine/tools-ai-adapter.test.ts` runs
- **THEN** AI tool format conversion is verified

#### Scenario: CLI adapter tests
- **WHEN** `tests/engine/tools-cli.test.ts` runs
- **THEN** CLI command integration with tool schema is verified

### Requirement: Tool handler execution

Tool handlers SHALL receive parameters as plain objects and return structured results (success/error, data).

#### Scenario: Successful tool execution
- **WHEN** tool handler is invoked with valid params
- **THEN** it returns `{ success: true, data: <result> }`

#### Scenario: Tool execution error
- **WHEN** tool handler encounters error
- **THEN** it returns `{ success: false, error: "message" }`

### Requirement: Tool documentation

Each tool in schema.ts SHALL have clear description and parameter documentation for AI/human comprehension.

#### Scenario: Tool description
- **WHEN** AI queries available tools
- **THEN** description explains what the tool does (e.g., "Create a rectangle with specified dimensions and position")

#### Scenario: Parameter descriptions
- **WHEN** AI reads parameter schema
- **THEN** each parameter has type and description (e.g., `width: { type: 'number', description: 'Rectangle width in pixels' }`)
