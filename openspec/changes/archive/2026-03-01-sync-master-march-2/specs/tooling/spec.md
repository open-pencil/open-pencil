## MODIFIED Requirements

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

### Requirement: Bun workspace monorepo
The project SHALL use Bun workspaces with packages: root (app), packages/core (@open-pencil/core), packages/cli (@open-pencil/cli), packages/docs (@open-pencil/docs). The workspace is configured in the root package.json. CLI is runnable via `bun open-pencil` in the workspace.

#### Scenario: Workspace packages resolve
- **WHEN** the app imports from @open-pencil/core
- **THEN** Bun resolves it to packages/core/ via workspace linking

## ADDED Requirements

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
