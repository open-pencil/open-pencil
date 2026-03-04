# tooling Specification

## Purpose
Build and development tooling. Vite 7 build system, oxlint linting, oxfmt formatting, typescript-go type checking, and Tailwind CSS 4 integration.
## Requirements
### Requirement: Vite 7 build system
The project SHALL use Vite 7 as the build tool with dev server at port 1420 and HMR support. VitePress SHALL be installed as a devDependency for the documentation site. The `docs:dev`, `docs:build`, and `docs:preview` scripts SHALL be added to package.json.

#### Scenario: Dev server
- **WHEN** `bun run dev` is executed
- **THEN** Vite dev server starts at http://localhost:1420 with hot module replacement

#### Scenario: Docs scripts available
- **WHEN** `bun run docs:dev` is executed
- **THEN** VitePress dev server starts for the documentation site

#### Scenario: Docs build
- **WHEN** `bun run docs:build` is executed
- **THEN** VitePress builds the documentation site to `docs/.vitepress/dist/`

#### Scenario: Docs preview
- **WHEN** `bun run docs:preview` is executed
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
The project SHALL use Bun workspaces with packages: root (app), packages/core (@open-pencil/core), packages/cli (@open-pencil/cli), packages/docs (@open-pencil/docs), packages/demos. The workspace is configured in the root package.json. CLI is runnable via `bun open-pencil` in the workspace. Demo recording is runnable via `bun run demo:record`.

#### Scenario: Workspace packages resolve
- **WHEN** the app imports from @open-pencil/core
- **THEN** Bun resolves it to packages/core/ via workspace linking

#### Scenario: Demo recording scripts available
- **WHEN** `bun run demo:record` is executed at the project root
- **THEN** the script delegates to the packages/demos recording workflow

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

