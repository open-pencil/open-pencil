# Contributing

Questions and ideas go to [GitHub Discussions](https://github.com/open-pencil/open-pencil/discussions) or [Discord](https://discord.gg/4wXc9fuZfm); open an issue for a reproducible bug. Report security problems through a [private advisory](https://github.com/open-pencil/open-pencil/security/advisories/new), not a public issue or PR.

## Where the rules live

- `CONTRIBUTING.md` (this file): setup, pull requests, validation, commits.
- [`AGENTS.md`](./AGENTS.md): repository map, cross-cutting conventions, and a `Guide` column pointing to the `AGENTS.md` inside each package or app domain. Read the root file and every guide on the path to the folder you change; coding agents pick them up the same way.
- [`packages/docs/development/`](packages/docs/development/): public explanations such as [architecture](https://openpencil.dev/development/architecture), [testing](packages/docs/development/testing.md), and the [roadmap](packages/docs/development/roadmap.md).

## Setup

```sh
git clone https://github.com/open-pencil/open-pencil.git
cd open-pencil
bun install
bun run dev:portless  # Web editor at https://open-pencil.localhost
bun run dev           # Fixed http://localhost:1420 for Playwright, Tauri, and Dev Containers
bun run tauri dev     # Desktop app (requires Rust)
```

The first Portless run creates and trusts a local HTTPS certificate. Linked Git worktrees receive branch-prefixed URLs such as `https://fix-ui.open-pencil.localhost` and matching `https://fix-ui.mcp.open-pencil.localhost` MCP bridges with isolated ports and socket files, so concurrent servers do not compete for port 1420. Run `bunx portless doctor` if routing or certificate trust fails.

The repository also works in any [Dev Container](https://containers.dev/)-compatible tool: the container pins Bun, installs dependencies, and forwards port 1420; start with `bun run dev`. It covers the web editor, packages, CLI, and automated checks. Native Tauri development needs [Rust](https://rustup.rs/) and the [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/) on the host.

For macOS release builds with ad-hoc signing (no Apple Developer account, local testing only):

```sh
APPLE_SIGNING_IDENTITY=- bun run tauri build -c '{"bundle": { "createUpdaterArtifacts": false }}'
```

## Making a change

- Before adding a helper, type, component, state mechanism, parser, or test utility, inspect the owning folder, nearby implementations, existing dependencies, and tests. Reuse or extend the established mechanism; extract genuinely shared logic instead of introducing a parallel implementation.
- Keep package boundaries and public exports intact. Keep pull requests focused: no temporary scaffolding, unrelated refactors, or changelog claims not represented by the diff.
- Update `CHANGELOG.md` for user-facing changes following the rules in `AGENTS.md` (Documentation and changelog).
- Tests follow the [testing architecture](packages/docs/development/testing.md) and `tests/AGENTS.md`. Extend an existing `tests/engine/**` suite until its domain migrates; do not create a duplicate home.
- `.fig` fixtures in `tests/fixtures/` are Git LFS. Use `git push --no-verify` to skip the slow LFS pre-push hook unless you changed `.fig` files.

## Quality checks

Run all of these before submitting a PR:

```sh
bun run check        # lint, type checks, architecture, docs, package, duplication, and tooling checks
bun run format       # oxfmt with import sorting
bun run test:unit    # bun:test engine/unit suite (test:unit:quick for the fast parallel loop)
bun run test         # Playwright browser E2E and visual regression
```

## Pull requests

Pull requests must be reviewable without guessing the author's intent.

### PR title

- Write the title in English.
- Be specific about the actual change; avoid vague titles such as `fix`, `update`, `some fixes`, `changes`, or `WIP`.
- Use Conventional Commits, for example `fix: handle empty exports` or `docs: clarify CLI setup`. The exact `Release vX.Y.Z` release-title exception is preserved. See [Commit messages](#commit-messages) for validation commands.

### PR body

- Follow the PR template and keep its headings. Use one short Summary paragraph for the problem, why it matters, and the outcome. Use What changed for one to three meaningful implementation details, not a repeated summary or a file-by-file inventory.
- Write concrete, direct prose. Avoid promotional claims, filler, decorative emojis, and unnecessary tables. Add a small example when the behavior is otherwise hard to explain; keep lengthy logs or design notes in linked material.
- Document commands actually run and their results, such as `bun run check`, targeted tests, or docs-only review. State relevant checks not run and why, and note whether a changelog entry is needed. Do not present planned validation as completed.
- Complete the AI assistance section. If an LLM materially helped create or modify the PR, list the model names you know. Write `None` otherwise. This is review context, not authorship attribution; prompts and transcripts are not required.
- Keep the body primarily in English. Code identifiers, file paths, logs, error messages, and short quoted examples may use their original language.

### Reviewability

Do not submit placeholder PRs. Remove template comments before opening a PR. Do not leave dangling issue references such as `Fixes #`, `TODO`, `TBD`, empty headings, unfilled sections, or similar unfinished text.

CodeRabbit may flag PR description or readability issues for maintainers to review. Missing template sections or validation details are normal review feedback; they are not, by themselves, a personal judgment on the contributor. Maintainers may close PRs manually when they are clearly automated, not written in English, unrelated to the project, or impossible to review without substantial guesswork. If you are unsure how to fix something, please open a detailed issue instead of submitting a placeholder PR.

## Commits

### Attribution

AI-assisted contributions are welcome. Credit human collaborators in commit authorship and `Co-authored-by` trailers; don't add AI assistants as co-authors or append tool-generated promotional signatures. Record AI assistance in the PR's existing AI assistance section instead. Preserve human attribution and required third-party notices.

The committed `.claude/settings.json` disables Claude Code's automatic commit/PR attribution and session links. Other tools should follow the same policy. This does not prohibit AI use, ordinary discussion of tools, or legitimate maintenance-bot workflows.

The Commit messages check flags known AI co-author identities in newly introduced commits, including merge and release commits. If it flags an automatically added trailer, remove only that trailer using the amendment guidance below; keep human credits and the PR disclosure. Unknown identities and promotional prose remain subject to normal review. Existing base-branch history is not rewritten.

### Commit messages

The **Commit messages** CI job checks every commit introduced by a PR, including docs-only PRs. It does not lint existing base-branch history or GitHub's synthetic merge commit. The aggregate CI result requires this job to pass.

Use `type(optional-scope): short description`, for example `fix(MCP): preserve connection settings`. Allowed types are `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, and `chore`. Keep subjects short, imperative, and narrowly scoped; explain rationale in the body. Keep headers within 100 characters and omit a trailing period. Product names retain their casing (DOM/CSS, HTML, JSX, Tailwind, Kiwi, `.fig`, MCP, CLI, AI, ACP, i18n); bodies and footers may contain long lines. Release commits use exactly `Release vX.Y.Z`.

PR titles follow the same convention because GitHub uses them as merge subjects. The separate **PR title** workflow checks new and updated PRs, including title edits, without rerunning the full CI suite. Title validation disables commitlint's default merge/revert exceptions. Release titles and commits retain the exact `Release vX.Y.Z` convention.

Commit-range validation retains commitlint's default merge/revert exceptions, but they are not a naming convention. Preserve the validated PR title when merging via CLI/API (`gh pr merge --subject` must use it), and use explicit conventional subjects for branch updates, for example `chore: merge master into my-branch`. Do not rewrite published history solely to normalize messages. These checks validate structure and known AI co-author identities, not whether a description is meaningful or the type is appropriate.

```sh
bun run check:commits --last
bun run check:commits --from origin/master --to HEAD --verbose
printf '%s\n' 'fix(MCP): preserve connection settings' | COMMITLINT_PR_TITLE=1 bun run check:commits
```

If a message fails, use the reported rule and commit subject to locate it. Amend your latest commit with `git commit --amend`, or use an interactive rebase for earlier commits on your PR branch. Coordinate before rewriting a shared branch. No local Git hooks are installed automatically; CI is the enforcement point.
