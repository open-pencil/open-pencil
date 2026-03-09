## Why

Master branch advanced after our previous sync (commits 22f8599..7a2694b). Key changes: docs moved to `packages/docs/` as `@open-pencil/docs`, repo renamed to open-pencil/open-pencil, Safari compatibility fixes, .fig export bugfix, CHANGELOG.md, CI/CD for app.openpencil.dev, npm trusted publishing, download links and messaging updates. Specs and docs reference stale `docs/` paths and miss new capabilities.

## What Changes

- Update all spec and doc path references from `docs/` to `packages/docs/`
- Update tooling spec with docs package extraction and npm publishing improvements
- Update vitepress-docs spec with new location and landing page changes (download links, "Open App" nav, "no subscription" messaging)
- Add .fig export COMPONENT/COMPONENT_SET → SYMBOL fix to fig-import spec
- Update desktop-app spec with Safari compatibility (save fallback, banner)
- Add CHANGELOG.md reference to tooling spec
- Update AGENTS.md with new paths and conventions
- Update Figma comparison: Safari save support improved
- Update Penpot comparison LOC stats if stale

## Capabilities

### New Capabilities
(none — changes are incremental updates to existing capabilities)

### Modified Capabilities
- `vitepress-docs`: docs moved to `packages/docs/`, new landing page features, download links, "Open App" nav link
- `tooling`: docs extracted to separate package, npm trusted publishing, CHANGELOG, CI app deploy workflow
- `fig-import`: .fig export fix for COMPONENT/COMPONENT_SET → SYMBOL mapping
- `desktop-app`: Safari save improvements, banner for File System Access API limitation
- `testing`: layers-panel test fixtures updated

## Impact

- **Specs:** 5 existing specs need path and content updates
- **AGENTS.md:** docs paths, commands, repo URL
- **No code changes** — all implementations already merged
