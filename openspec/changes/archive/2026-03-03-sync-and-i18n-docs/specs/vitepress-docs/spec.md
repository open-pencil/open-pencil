## MODIFIED Requirements

### Requirement: VitePress documentation site
The project SHALL have a VitePress documentation site in the `packages/docs/` directory as `@open-pencil/docs` workspace package, with its own `.vitepress/config.ts` configuration, `package.json`, and locale configuration for 6 languages (en, de, it, fr, es, pl).

#### Scenario: Docs dev server starts
- **WHEN** `cd packages/docs && bun run dev` is executed
- **THEN** VitePress dev server starts with all locales available

#### Scenario: Docs build succeeds
- **WHEN** `cd packages/docs && bun run build` is executed
- **THEN** VitePress produces a static site with all locale pages
