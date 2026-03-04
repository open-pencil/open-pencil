## MODIFIED Requirements

### Requirement: Bun workspace monorepo
The project SHALL use Bun workspaces with packages: root (app), packages/core (@open-pencil/core), packages/cli (@open-pencil/cli), packages/docs (@open-pencil/docs), packages/demos. The workspace is configured in the root package.json. CLI is runnable via `bun open-pencil` in the workspace. Demo recording is runnable via `bun run demo:record`.

#### Scenario: Workspace packages resolve
- **WHEN** the app imports from @open-pencil/core
- **THEN** Bun resolves it to packages/core/ via workspace linking

#### Scenario: Demo recording scripts available
- **WHEN** `bun run demo:record` is executed at the project root
- **THEN** the script delegates to the packages/demos recording workflow
