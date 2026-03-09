## Context

This change syncs OpenSpec specs and VitePress documentation with master branch commits 63748ec through 20290f6. All code is already implemented and tested (2571 LOC of new tests). Tasks focus on documentation sync, not code changes.

**References:**
- Proposal: `openspec/changes/sync-specs-docs-with-master/proposal.md` — why and what
- Design: `openspec/changes/sync-specs-docs-with-master/design.md` — how to sync (code as source of truth)
- Delta specs: `openspec/changes/sync-specs-docs-with-master/specs/` — requirements derived from implemented code

**Note:** `docs/eval-command.md` already exists (437 lines, merged from master). Tasks update cross-references and navigation, not content creation.

## 1. Create new capability specs

- [x] 1.1 Create `openspec/specs/figma-plugin-api/spec.md` by resolving delta spec (strip ADDED markers, keep requirement content verbatim)
- [x] 1.2 Create `openspec/specs/eval-command/spec.md` by resolving delta spec
- [x] 1.3 Create `openspec/specs/app-menu/spec.md` by resolving delta spec
- [x] 1.4 Create `openspec/specs/autosave/spec.md` by resolving delta spec

## 2. Update existing capability specs with delta changes

**Merge strategy:**
- **ADDED Requirements** → append to end of requirements section
- **MODIFIED Requirements** → find matching requirement by header text (whitespace-insensitive), replace entire block (from `### Requirement:` through all scenarios). If no exact match, show diff and resolve manually.
- **REMOVED Requirements** → delete requirement block, add deprecation note if needed
- Preserve existing spec structure (Purpose, other requirements)

- [x] 2.1 Merge cli delta: read `changes/.../specs/cli/spec.md`, append ADDED requirements, replace MODIFIED "CLI commands" requirement in `openspec/specs/cli/spec.md`
- [x] 2.2 Merge tooling delta: append ADDED requirements from `changes/.../specs/tooling/spec.md` to `openspec/specs/tooling/spec.md`
- [x] 2.3 Merge testing delta: append ADDED requirements from `changes/.../specs/testing/spec.md` to `openspec/specs/testing/spec.md`
- [x] 2.4 Merge vitepress-docs delta: append ADDED requirements from `changes/.../specs/vitepress-docs/spec.md` to `openspec/specs/vitepress-docs/spec.md`

## 3. Update Figma comparison matrix

**Table format:** Markdown table with columns: Feature | Status | Notes. Status uses emoji: ✅ Supported, 🟡 Partial, 🔲 Not yet.

- [x] 3.1 Add row to Interface & Navigation table: `| App menu (browser mode) | ✅ | File, Edit, View, Object, Text, Arrange menus; Tauri uses native menus |`
- [x] 3.2 Update AI tools row in Interface & Navigation: change status to 🟡, update Notes to mention "10 tools via OpenRouter + unified tool definitions + eval command integration; no AI image generation yet"
- [x] 3.3 Add new "Plugin API & Scripting" section after "Import & Export" with table row: `| Eval command with Figma Plugin API | ✅ | Headless JavaScript execution with figma global object matching Figma's plugin surface |`
- [x] 3.4 Recalculate coverage stats: 85 of 152 addressed (66 ✅, 19 🟡, 67 🔲)

## 4. Update Penpot comparison

- [x] 4.1 Add paragraph to Architecture section in `docs/guide/comparison.md` after "Verdict: Architecture" subsection: "OpenPencil's eval command with Figma Plugin API enables headless scripting and automation that Penpot lacks. Penpot has no plugin system; OpenPencil's `figma` global object mirrors Figma's API for script portability." Link to `/eval-command` for details. (Note: eval-command.md already has 437 lines of examples; link instead of duplicating)

## 5. Update Features documentation

- [x] 5.1 Add app menu entry to `docs/guide/features.md` (File, Edit, View, Object, Text, Arrange menus; browser-only note)
- [x] 5.2 Add autosave entry to `docs/guide/features.md` (3-second debounce, file handle requirement)
- [x] 5.3 Add headless scripting / eval command entry to `docs/guide/features.md` (link to eval-command.md)
- [x] 5.4 Update AI tools entry in `docs/guide/features.md` to mention unified tool definitions
- [x] 5.5 Landing page feature cards already cover eval/CLI via "Programmable" card — no changes needed

## 6. Update VitePress navigation

**Note:** New spec files (figma-plugin-api, eval-command, app-menu, autosave) are OpenSpec internal specs, not user-facing docs. Only eval-command has user docs at `docs/eval-command.md`.

- [x] 6.1 Add "Eval Command" entry to Reference sidebar in `docs/.vitepress/config.ts`: inserted after "File Format" in Reference items array
- [x] 6.2 Verify deferred to section 8

## 7. Update AGENTS.md

**Note:** AGENTS.md already correctly documents tools (`packages/core/src/tools/schema.ts`), FigmaAPI (`packages/core/src/figma-api.ts`), and eval command in "Tools (AI / MCP / CLI)" section per design.md. Only UI section needs update.

- [x] 7.1 Added AppMenu bullet to UI section in AGENTS.md

## 8. Verification

- [x] 8.1 `bun run docs:build` passed — no broken links, built in 35.95s
- [x] 8.2 eval-command.html generated in dist/
- [x] 8.2a Cross-links verified via successful build (VitePress validates internal links)
- [x] 8.3 Figma comparison: app menu row added, AI tools updated, Plugin API section added, stats recalculated (85/152)
- [x] 8.4 Penpot comparison: headless scripting paragraph added with /eval-command link
- [x] 8.5 All 4 new spec files have valid heading hierarchy (### Requirement + #### Scenario)
- [x] 8.6 All 4 merged specs: additions only (0 removed lines), existing requirements preserved
- [x] 8.7 AGENTS.md: AppMenu bullet added in correct format within UI section
- [x] 8.8 Sidebar config updated with Eval Command entry in Reference group

## 9. Archive preparation

- [x] 9.1 All tasks complete
- [x] 9.2 All artifacts present: proposal.md, design.md, specs/ (8 delta specs), tasks.md
- [x] 9.3 Delta specs merged: 4 new specs created, 4 existing specs updated (additions only)
- [ ] 9.4 Ready for `/opsx:archive`
