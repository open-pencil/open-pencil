## Context

Sync with master commits 22f8599..7a2694b. Docs moved to `packages/docs/`. Repo renamed to open-pencil/open-pencil. All code already merged.

## 1. Fix stale docs paths in specs

- [x] 1.1 In `openspec/specs/vitepress-docs/spec.md`: replace all `docs/` references with `packages/docs/`, update Purpose line, update VitePress site requirement with new location, add "Open App" nav and download links to landing page requirement
- [x] 1.2 In `openspec/specs/tooling/spec.md`: replace `docs/` → `packages/docs/` in build paths, update Bun workspace monorepo requirement to list 4 packages (add docs), add CHANGELOG, npm trusted publishing, and CI app deploy requirements
- [x] 1.3 In `openspec/specs/fig-import/spec.md`: add COMPONENT/COMPONENT_SET → SYMBOL export mapping requirement
- [x] 1.4 In `openspec/specs/desktop-app/spec.md`: add Safari save fallback and compatibility banner requirements
- [x] 1.5 In `openspec/specs/testing/spec.md`: update layers panel test requirement with current demo shape names

## 2. Update AGENTS.md

- [x] 2.1 Update docs-related commands: `bun run docs:dev` → `cd packages/docs && bun run dev` (or equivalent workspace command)
- [x] 2.2 Add `packages/docs` mention to Monorepo section
- [x] 2.3 Add Safari save note to File format section (download fallback for browsers without File System Access)

## 3. Update docs content

- [x] 3.1 Verify `packages/docs/guide/figma-comparison.md` has correct Safari/save info (check Import & Export section, "Save / Save As" row notes)
- [x] 3.2 Verify `packages/docs/guide/comparison.md` LOC stats — update if stale

## 4. Verification

- [x] 4.1 Run `cd packages/docs && bun run build` — verify no broken links
- [x] 4.2 Verify no remaining `docs/` references in specs (should all be `packages/docs/`)
