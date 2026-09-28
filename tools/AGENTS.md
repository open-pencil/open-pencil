# Repo tooling, CI, and releases

Private tooling lives under `tools/<domain>/{src,tests}` with kebab-case domains and focused tests; `bun run test:tools` runs every tool package with a `test` script. `scripts/` may contain only tiny compatibility entrypoints.

- Resolve the workspace with `resolveWorkspaceRoot` from `@open-pencil/package-artifacts`, not parent-directory traversal. Use domain aliases for cross-directory tooling imports, including tests; keep sibling imports relative.
- `tools/architecture` (Steiger rules) backs `check:arch`; `tools/docs` backs `check:docs`, including the guide-map check; `tools/i18n`, `tools/release-packages`, `tools/unit-tests`, `tools/ci`, and `tools/brand` own their namesake commands.

## CI

- `.github/workflows/ci.yml` and `heavy-tests.yml` define validation gates. PR CI always classifies changed paths through `tools/ci/src/policy.ts`: root docs, package READMEs, every `AGENTS.md`, `packages/docs` Markdown and assets, and skill Markdown are docs-only; runtime prompt Markdown, executable examples, configuration, and unknown paths require code validation.
- Docs-only changes run documentation integrity and the docs build; everything else runs the full suites. The aggregate `CI result` gate requires successful classification and every applicable job; failures, cancellations, and unexpected skips cannot pass. Do not restore workflow-level path filtering on required CI.
- `commitlint.config.ts` enforces commit structure in the **Commit messages** job; the separate **PR title** workflow validates titles. Preserve the `Release vX.Y.Z` exception and product casing when changing rules; the known AI co-author check does not rewrite base history. Gate policy lives in `tools/ci/src/policy.ts`.
- App and docs production workflows run on `v*` tags or `workflow_dispatch`, not ordinary `master` pushes.

## Releases

- Update versions in the root and publishable package manifests plus `desktop/tauri.conf.json` and `desktop/Cargo.toml`; move `Unreleased` into `## x.y.z — YYYY-MM-DD`; commit `Release vX.Y.Z`; tag and push `vX.Y.Z`.
- `.github/workflows/build.yml` is the source of truth: `v*` tags (or dispatches for an immutable stable tag) build shared frontend/package outputs once, build signed desktop artifacts in parallel, verify and attest one complete same-run artifact set, publish npm packages, and replace the draft release assets using the exact changelog section. Policy, provenance, and recovery: `tools/release-packages/README.md`.
- Public workspace packages are discovered by the package-artifacts catalog. Bun source exports require the complete `src` directory in package contents; Node exports use `dist`. Release preparation must preserve resolution maps. Prepared publish directories receive the root `LICENSE` when a package has none of its own, and every package needs a `README.md` because npm renders it. Publishing uses prepared npm tarballs verified through the shared Node/Bun consumer checks; never publish package directories manually. `test:packages` first runs the packaging guards in `tools/package-quality/src/smoke/guards.ts`: fixture manifests packed with the real `npm pack` that must trip the tarball inspector and the Node/Bun consumer checks before those checks vouch for real packages.
- Ensure Tauri and Apple signing/notarization secrets are configured. Verify the draft title, body, and artifacts, then publish. Release titles are exactly the tag (`vX.Y.Z`) without a product-name prefix.
- Homebrew's `openpencil` cask is managed upstream: BrewTestBot proposes bumps and Homebrew merges them. Check the upstream cask PR after publication; do not push to the archived custom tap or add bump automation. Users install the app with `brew install --cask openpencil` and the CLI through npm or Bun.

## Brand assets

Canonical artwork lives in `assets/brand/` (main mark and optical micro master; see its README). `tools/brand/` derives web, docs, and native icons with RealFaviconGenerator and Tauri; generated assets are ignored, not committed. Vite and VitePress configs prepare their own targets, and Tauri dev/build hooks prepare native icons.
