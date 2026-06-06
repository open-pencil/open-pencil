# OpenPencil Copilot instructions

OpenPencil is a Bun workspace for a Vue 3 + CanvasKit design editor with Tauri desktop support.

## Pull request requirements

- Write PR titles and bodies in English.
- Follow `.github/PULL_REQUEST_TEMPLATE.md` exactly.
- Remove template comments and placeholders before opening a PR.
- Never leave dangling text like `Fixes #`, `TODO`, `TBD`, or unfinished checklist explanations.
- Summarize what changed, why it changed, and how it was validated.
- If a user-facing change is made, update `CHANGELOG.md`.
- Follow `CONTRIBUTING.md` and `AGENTS.md` for repository conventions.

## Validation

Use Bun, not npm or Node scripts unless the package explicitly requires Node.

Before proposing changes, run targeted checks when possible and document them in the PR body. For broad changes, run:

```sh
bun run check
```

Package publishing changes should also run:

```sh
bun scripts/smoke-packages.ts
```

## Code conventions

- No `any` unless there is a clear typed alternative problem and a justification.
- No non-null assertions; use guards.
- Use `crypto.getRandomValues()`, never `Math.random()`.
- Keep Vue components free of `<style>` blocks.
- Use existing dependencies and Reka UI components before hand-rolling UI.
- Preserve architecture boundaries from `AGENTS.md`.
