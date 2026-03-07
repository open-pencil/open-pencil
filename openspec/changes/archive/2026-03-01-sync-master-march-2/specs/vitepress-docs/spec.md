## MODIFIED Requirements

### Requirement: VitePress documentation site
The project SHALL have a VitePress documentation site in the `packages/docs/` directory as `@open-pencil/docs` workspace package, with its own `.vitepress/config.ts` configuration and `package.json`.

#### Scenario: Docs dev server starts
- **WHEN** `cd packages/docs && bun run dev` is executed
- **THEN** VitePress dev server starts and serves the documentation site

#### Scenario: Docs build succeeds
- **WHEN** `cd packages/docs && bun run build` is executed
- **THEN** VitePress produces a static site in `packages/docs/.vitepress/dist/`

### Requirement: Landing page
The docs site SHALL have an index.md landing page with project name, tagline "Open-source Figma alternative. Fully local, AI-native, programmable.", quick navigation to guide and reference sections, download links (GitHub Releases, app.openpencil.dev), and "no subscription, bring your own API key" messaging.

#### Scenario: Landing page loads
- **WHEN** user opens the docs site root URL
- **THEN** a landing page with "OpenPencil" title, tagline, download links, and feature highlights is displayed

#### Scenario: Open App link
- **WHEN** user clicks "Open App" in the top nav
- **THEN** browser navigates to https://app.openpencil.dev

### Requirement: Dark theme
The docs site SHALL use dark appearance to match the editor's dark aesthetic.

#### Scenario: Dark mode
- **WHEN** user opens the documentation site
- **THEN** the site renders with dark theme by default
