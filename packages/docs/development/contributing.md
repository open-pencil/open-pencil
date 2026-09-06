# Contributing

The root [`CONTRIBUTING.md`](https://github.com/open-pencil/open-pencil/blob/master/CONTRIBUTING.md) is the source of truth for setup, pull-request requirements, validation, and commit expectations. Developers and coding agents should also read [`AGENTS.md`](https://github.com/open-pencil/open-pencil/blob/master/AGENTS.md) for current package ownership and architecture rules.

## Project structure

OpenPencil is a Bun monorepo: framework-neutral document and format packages feed the core editor, DOM/CSS and Vue SDK layers, automation entry points, and the Tauri/Vite app.

See [Architecture](/development/architecture) for a public overview. Use root `AGENTS.md` when exact package ownership or paths matter; do not infer ownership from an older copied tree.

## Development setup

```sh
bun install
bun run dev          # Editor at localhost:1420
bun run docs:dev     # Docs at localhost:5173
```

## Pull requests

Follow the root PR template. Explain what changed, why it changed, and how it was validated. Remove template comments and unfinished placeholders, keep the title in English and the body primarily in English, and complete the AI assistance section.

CodeRabbit may flag description or readability issues for maintainers to review. Missing template sections or validation details are normal review feedback, not by themselves a judgment on the contributor.

## Validation

Run the checks relevant to the change. The normal complete gate is:

```sh
bun run check
bun run format
bun run test:unit
bun run test
```

Rendering and other pixel-affecting changes require targeted visual coverage. Package publishing changes require the package verification commands documented in `AGENTS.md`.

## Test placement

Place tests in the established layer and mirror the source domain where practical:

- `tests/e2e/**/*.spec.ts` — browser UI and visual behavior.
- `tests/figma/**/*.spec.ts` — Figma automation.
- `tests/engine/**/*.test.ts` — engine and unit behavior.
- `tests/helpers/**` — shared test utilities.
- Package-local `tests/**` — standalone package coverage where already established.

Test behavior and stable contracts, not source text or implementation details. Before adding a test file or helper, inspect nearby tests and follow their existing structure.

### Test selectors

Playwright tests should locate behavior the way users and assistive technology do: prefer roles and accessible names, labels, and visible text. Scope repeated controls to a named region. Multi-part UI components expose local `data-slot` anatomy, while stable app concepts may expose semantic attributes such as `data-property`, `data-command`, or `data-node-id`.

Reserve `data-test-id` for integration boundaries that have no meaningful user-facing or domain identity. Do not add test-ID props to reusable components or generate compound IDs from component nesting.

## SDK documentation

VitePress is the canonical public documentation, while Storybook is the internal component-state workshop. Shared Vue demos live beside their SDK primitives and are embedded in both surfaces. The docs Tailwind entry scans these demos, so examples use the same utility-first styling in both environments.

Component API tables are extracted from Vue source and JSDoc with `vue-component-meta`. Keep descriptions next to public props, events, and slots instead of duplicating signatures in Markdown. VitePress processes SDK examples with Twoslash so imports and types stay aligned with the public package API.
