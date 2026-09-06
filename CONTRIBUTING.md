# Contributing

## Setup

```bash
git clone https://github.com/open-pencil/open-pencil.git
cd open-pencil
bun install
```

## Development

```bash
bun run dev          # Vite dev server on localhost:1420
bun run tauri dev    # Tauri desktop app with hot reload

# For macOS release builds with ad-hoc signing (no Apple Developer account, local testing only):
APPLE_SIGNING_IDENTITY=- bun run tauri build -c '{"bundle": { "createUpdaterArtifacts": false }}'
```

## Pull requests

Pull requests must be reviewable without guessing the author's intent.

### PR title

- Write the title in English.
- Be specific about the actual change; avoid vague titles such as `fix`, `update`, `some fixes`, `changes`, or `WIP`.
- Use Conventional Commits when it fits the change, for example `fix: handle empty exports` or `docs: clarify CLI setup`.

### PR body

- Follow the PR template when one is provided.
- Explain what changed and why it changed.
- Include a concrete list or paragraph of meaningful changes.
- Document validation, such as `bun run check`, targeted tests, docs-only review, or an explicit reason validation was not run.
- Complete the AI assistance section. If an LLM materially helped create or modify the PR, list the model names you know. Write `None` otherwise. This is review context, not authorship attribution; prompts and transcripts are not required.
- Keep the body primarily in English. Code identifiers, file paths, logs, error messages, and short quoted examples may use their original language.

### Reviewability

Do not submit placeholder PRs. Remove template comments before opening a PR. Do not leave dangling issue references such as `Fixes #`, `TODO`, `TBD`, empty headings, unfilled sections, or similar unfinished text.

CodeRabbit may flag PR description or readability issues for maintainers to review. Missing template sections or validation details are normal review feedback; they are not, by themselves, a personal judgment on the contributor. Maintainers may close PRs manually when they are clearly automated, not written in English, unrelated to the project, or impossible to review without substantial guesswork. If you are unsure how to fix something, please open a detailed issue instead of submitting a placeholder PR.

## Quality checks

Run all of these before submitting a PR:

```bash
bun run check        # lint, type checks, architecture, package, duplication, and tooling checks
bun run format       # oxfmt with import sorting
bun run test:unit    # bun:test engine/unit suite
bun run test         # Playwright browser E2E and visual regression
```

## Project structure

OpenPencil is a Bun monorepo. Stable ownership boundaries are:

- `packages/scene-graph`, `pen`, `kiwi`, and `fig` — framework-neutral document models and format layers.
- `packages/core` — renderer, layout, editor core, Figma API, tools, and app-facing document I/O.
- `packages/dom-css` and `vue` — DOM/CSS projection and the headless Vue SDK.
- `packages/cli`, `mcp`, and `harness` — automation and agent-facing entry points.
- `src/app` — app services, state, and integrations; `src/components` and `src/views` — app UI and views.
- `packages/docs` — the published VitePress site.

See [`AGENTS.md`](./AGENTS.md) for canonical package ownership and architecture rules, and [Architecture](https://openpencil.dev/development/architecture) for the public overview.

## Codebase fit

Before adding a helper, type, component, state mechanism, parser, or test utility, inspect the owning domain, nearby implementations, existing dependencies, and tests. Reuse or extend the established mechanism; extract genuinely shared logic instead of introducing a parallel implementation.

Keep package boundaries and public exports intact. Keep pull requests focused: exclude temporary or development scaffolding, unrelated refactors, and changelog claims that are not represented by the diff.

## Tests

Place tests in the established layer and mirror the source domain where practical:

- `tests/e2e/**/*.spec.ts` — browser UI and visual behavior.
- `tests/figma/**/*.spec.ts` — Figma automation.
- `tests/engine/**/*.test.ts` — engine and unit behavior.
- `tests/helpers/**` — shared test utilities.
- Package-local `tests/**` — standalone package coverage where that structure already exists.

Test behavior and stable contracts, not source text or implementation details. Before adding a test file or helper, inspect nearby tests and follow their existing structure.

### Test selectors

Playwright tests should locate behavior the way users and assistive technology do: prefer roles and accessible names, labels, and visible text. Scope repeated controls to a named region. Multi-part components expose local `data-slot` anatomy, while stable app concepts may expose semantic attributes such as `data-property`, `data-command`, or `data-node-id`.

Reserve `data-test-id` for integration boundaries that have no meaningful user-facing or domain identity. Do not add test-ID props to reusable components or generate compound IDs from component nesting.

## Conventions

See [`AGENTS.md`](./AGENTS.md) for the full architecture reference, code conventions, and quality checklist. Key points:

- Bun runtime, not Node.
- Tailwind 4 for styles; no inline CSS or component `<style>` blocks.
- No `any` or non-null assertions; use guards and precise types.
- Use public package exports across package boundaries.
- Use `crypto.getRandomValues()`, never `Math.random()`.
- Use existing dependencies and Reka UI components before hand-rolling.
- Keep UI labels translatable and shortcuts in the shared command registry.

## Test fixtures

`.fig` fixtures in `tests/fixtures/` are Git LFS. Use `git push --no-verify` to skip the slow LFS pre-push hook unless you changed `.fig` files.

## Commits

Follow the commit-message conventions in [`AGENTS.md`](./AGENTS.md). Update `CHANGELOG.md` for user-facing changes.
