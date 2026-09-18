# Contributing

Questions and ideas go to [GitHub Discussions](https://github.com/open-pencil/open-pencil/discussions) or [Discord](https://discord.gg/4wXc9fuZfm); open an issue for a reproducible bug.

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
- Use Conventional Commits, for example `fix: handle empty exports` or `docs: clarify CLI setup`. The exact `Release vX.Y.Z` release-title exception is preserved. See [Commit messages](#commit-messages) for validation commands.

### PR body

- Follow the PR template when one is provided.
- Keep the existing template headings. Use one short Summary paragraph for the problem, why it matters, and the outcome. Use What changed for one to three meaningful implementation details, not a repeated summary or a file-by-file inventory.
- Write concrete, direct prose. Avoid promotional claims, filler, decorative emojis, and unnecessary tables. Add a small example when the behavior is otherwise hard to explain; keep lengthy logs or design notes in linked material.
- Document commands actually run and their results, such as `bun run check`, targeted tests, or docs-only review. State relevant checks not run and why, and note whether a changelog entry is needed. Do not present planned validation as completed.
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

Follow the [testing architecture](packages/docs/development/testing.md) for ownership, helpers, fixtures, browser adapters and migration rules. Package-local tests mirror their source domains; central integration is reserved for genuinely cross-owner contracts. E2E follows user workflows rather than implementation files.

Existing `tests/engine/**` coverage moves domain-by-domain with runner discovery, not opportunistically during feature work. Extend the existing home until that migration; do not create a duplicate suite. Test behavior and stable contracts, not source text. During iteration, run focused checks for the changed contract rather than the complete suite after every edit.

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

### Attribution

AI-assisted contributions are welcome. Credit human collaborators in commit authorship and `Co-authored-by` trailers; don't add AI assistants as co-authors or append tool-generated promotional signatures. Record AI assistance in the PR's existing AI assistance section instead. Preserve human attribution and required third-party notices.

The committed `.claude/settings.json` disables Claude Code's automatic commit/PR attribution and session links. Other tools should follow the same policy. This does not prohibit AI use, ordinary discussion of tools, or legitimate maintenance-bot workflows.

The Commit messages check flags known AI co-author identities in newly introduced commits, including merge and release commits. If it flags an automatically added trailer, remove only that trailer using the amendment guidance below; keep human credits and the PR disclosure. Unknown identities and promotional prose remain subject to normal review. Existing base-branch history is not rewritten.

### Commit messages

The **Commit messages** CI job checks every commit introduced by a PR, including docs-only PRs. It does not lint existing base-branch history or GitHub's synthetic merge commit. The aggregate CI result requires this job to pass.

Use `type(optional-scope): short description`, for example `fix(MCP): preserve connection settings`. Allowed types are `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, and `chore`. Keep headers within 100 characters and omit a trailing period. Product names retain their casing; bodies and footers may contain long lines.

PR titles follow the same convention because GitHub uses them as merge subjects. The separate **PR title** workflow checks new and updated PRs, including title edits, without rerunning the full CI suite. Title validation disables commitlint's default merge/revert exceptions. Release titles and commits retain the exact `Release vX.Y.Z` convention.

Commit-range validation retains commitlint's default merge/revert exceptions, but they are not a naming convention. Preserve the validated PR title when merging via CLI/API, and use explicit conventional subjects for branch updates, for example `chore: merge master into my-branch`. Do not rewrite published history solely to normalize messages. These checks validate structure and known AI co-author identities, not whether a description is meaningful or the type is appropriate.

```sh
bun run check:commits --last
bun run check:commits --from origin/master --to HEAD --verbose
printf '%s\n' 'fix(MCP): preserve connection settings' | COMMITLINT_PR_TITLE=1 bun run check:commits
```

If a message fails, use the reported rule and commit subject to locate it. Amend your latest commit with `git commit --amend`, or use an interactive rebase for earlier commits on your PR branch. Coordinate before rewriting a shared branch. No local Git hooks are installed automatically; CI is the enforcement point.
