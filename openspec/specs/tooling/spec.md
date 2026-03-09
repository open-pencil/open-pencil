# tooling Specification

## Purpose
Build and development tooling. Vite 7 build system, oxlint linting, oxfmt formatting, typescript-go type checking, and Tailwind CSS 4 integration.
## Requirements
### Requirement: Vite 7 build system
The project SHALL use Vite 7 as the build tool with dev server at port 1420 and HMR support. Documentation lives in `packages/docs/` as `@open-pencil/docs` workspace package with its own dev/build/preview scripts.

#### Scenario: Dev server
- **WHEN** `bun run dev` is executed
- **THEN** Vite dev server starts at http://localhost:1420 with hot module replacement

#### Scenario: Docs dev
- **WHEN** `cd packages/docs && bun run dev` is executed
- **THEN** VitePress dev server starts for the documentation site

#### Scenario: Docs build
- **WHEN** `cd packages/docs && bun run build` is executed
- **THEN** VitePress builds the documentation site to `packages/docs/.vitepress/dist/`

#### Scenario: Docs preview
- **WHEN** `cd packages/docs && bun run preview` is executed
- **THEN** a static server previews the built documentation site

### Requirement: oxlint linting
The project SHALL use oxlint for fast linting with project-specific configuration in oxlint.json.

#### Scenario: Lint check
- **WHEN** `bun run lint` is executed
- **THEN** oxlint checks src/ for issues based on oxlint.json rules

### Requirement: oxfmt formatting
The project SHALL use oxfmt for code formatting with configuration in .oxfmtrc.json.

#### Scenario: Format code
- **WHEN** `bun run format` is executed
- **THEN** oxfmt formats all files in src/ according to project rules

### Requirement: typescript-go type checking
The project SHALL use typescript-go (tsgo) for type checking via `bun run typecheck`.

#### Scenario: Type check
- **WHEN** `bun run typecheck` is executed
- **THEN** tsgo --noEmit checks all TypeScript files for type errors

### Requirement: Combined check command
`bun run check` SHALL run both lint and typecheck sequentially.

#### Scenario: Full check
- **WHEN** `bun run check` is executed
- **THEN** oxlint runs first, then tsgo, and both must pass

### Requirement: Tailwind CSS 4 integration
Tailwind CSS 4 SHALL be integrated via @tailwindcss/vite plugin.

#### Scenario: Tailwind classes work
- **WHEN** a Vue component uses Tailwind utility classes
- **THEN** the corresponding CSS is generated and applied

### Requirement: @/ import alias
The project SHALL configure a `@/` → `src/` path alias in both `vite.config.ts` (resolve.alias) and `tsconfig.json` (paths). All cross-directory imports SHALL use `@/` instead of relative `../` paths. Same-directory `./` imports are kept as-is.

#### Scenario: Import with alias
- **WHEN** a component in `src/components/` imports from `src/engine/`
- **THEN** the import uses `@/engine/` instead of `../../engine/`

### Requirement: Shared types module
Shared primitive types (Vector, Matrix, Rect) SHALL be defined in `src/types.ts` and imported across the codebase. Window API declarations (File System Access, queryLocalFonts) SHALL be in `src/global.d.ts`. Inline type duplicates SHALL be eliminated.

#### Scenario: Shared Vector type
- **WHEN** multiple files need a 2D point type
- **THEN** they import `Vector` from `@/types` instead of defining their own

### Requirement: Zero lint and type errors
The codebase SHALL maintain 0 oxlint warnings and 0 tsgo type errors. `bun run check` SHALL pass cleanly.

#### Scenario: Clean check
- **WHEN** `bun run check` is executed
- **THEN** both lint and typecheck pass with zero issues

### Requirement: Bun workspace monorepo
The project SHALL use Bun workspaces with packages: root (app), packages/core (@open-pencil/core), packages/cli (@open-pencil/cli), packages/docs (@open-pencil/docs). The workspace is configured in the root package.json. CLI is runnable via `bun open-pencil` in the workspace.

#### Scenario: Workspace packages resolve
- **WHEN** the app imports from @open-pencil/core
- **THEN** Bun resolves it to packages/core/ via workspace linking

### Requirement: npm publishing preparation
@open-pencil/core and @open-pencil/cli SHALL have proper package.json fields for npm publishing: name, version, description, exports, main, types, files, license, repository.


### Requirement: Copy-paste detection
The project SHALL use jscpd for copy-paste detection. The `bun run jscpd` command SHALL scan for duplicated code blocks.

#### Scenario: Detect duplicates
- **WHEN** `bun run jscpd` is run
- **THEN** duplicated code blocks are reported with locations and percentages

### Requirement: Kiwi serialization consolidation
Shared kiwi serialization logic (sceneNodeToKiwi, buildFigKiwi, parseFigKiwiChunks, decompressFigKiwiDataAsync) SHALL be extracted to packages/core/src/kiwi-serialize.ts. The app's src/kiwi/ SHALL re-export from core, eliminating the vendored kiwi-schema copy.

#### Scenario: Clipboard and fig-export share serialization
- **WHEN** clipboard.ts and fig-export.ts serialize nodes to kiwi
- **THEN** both use the shared kiwi-serialize.ts functions

### Requirement: Test coverage script
The project SHALL include a `test:coverage` script for measuring code coverage.

#### Scenario: Run coverage
- **WHEN** `bun run test:coverage` is run
- **THEN** test coverage metrics are reported

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


### Requirement: CHANGELOG
The project SHALL maintain a CHANGELOG.md in the root following Keep a Changelog conventions.

#### Scenario: Changelog exists
- **WHEN** user reads CHANGELOG.md
- **THEN** version history with categorized changes (Editor, CLI, File Format, etc.) is listed

### Requirement: npm trusted publishing
Package configs SHALL include `repository` field and `provenance: true` for npm trusted publishing via GitHub Actions.

#### Scenario: Publish with provenance
- **WHEN** GitHub Actions release workflow runs
- **THEN** packages are published to npm with provenance attestation

### Requirement: CI app deployment
The project SHALL have a GitHub Actions workflow (`app.yml`) for deploying the web app to app.openpencil.dev.

#### Scenario: App deploys on push
- **WHEN** code is pushed to main branch
- **THEN** GitHub Actions builds and deploys the app
