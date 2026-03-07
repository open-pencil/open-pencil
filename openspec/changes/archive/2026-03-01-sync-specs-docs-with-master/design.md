## Context

OpenSpec and VitePress documentation fell out of sync after a major merge from master (commits 63748ec through 20290f6). The merge introduced:
- Figma Plugin API (`packages/core/src/figma-api.ts`, 1119 LOC) mirroring Figma's plugin surface for headless scripting
- Eval CLI command (`packages/cli/src/commands/eval.ts`) enabling JavaScript execution against .fig files
- Unified tool definitions (`packages/core/src/tools/`) centralizing AI/CLI/MCP tool schemas
- App menu for browser mode (`src/components/AppMenu.vue`, 196 LOC)
- Autosave with 3-second debounce (`src/stores/editor.ts`)
- Extensive test coverage (2571 LOC across 5 new test files)
- Comprehensive eval command documentation (`docs/eval-command.md`, 437 LOC)

These changes are implemented and tested but lack corresponding OpenSpec specs and comprehensive VitePress doc updates (especially comparison matrices). Current state creates documentation debt and risks divergence between code and specs.

**Constraints:**
- Specs live in `openspec/specs/` (main specs) and `openspec/changes/*/specs/` (delta specs during active changes)
- Documentation lives in `docs/` as a VitePress site (not a separate package, just a directory with `.vitepress/config.ts`)
- Changes are already implemented — this is a **documentation sync** task, not a feature build
- Must preserve existing spec structure and documentation style

## Goals / Non-Goals

**Goals:**
- Create OpenSpec specs for 4 new capabilities (figma-plugin-api, eval-command, app-menu, autosave)
- Update 4 existing capability specs (cli, tooling, testing, vitepress-docs) with delta specs
- Update Figma comparison matrix (`docs/guide/figma-comparison.md`) to reflect new features
- Update Penpot comparison (`docs/guide/comparison.md`) to highlight headless scripting
- Ensure specs match implemented behavior (read code/tests as source of truth)
- Link specs to VitePress docs where appropriate

**Non-Goals:**
- Changing code implementation (code is already merged and tested)
- Creating new VitePress articles (eval-command.md already exists)
- Restructuring spec organization or schemas
- Backward-compatibility analysis (all changes are additive)

## Decisions

### **Decision 1: Documentation is sync, not discovery**

**Choice:** Treat code/tests as source of truth; specs document implemented behavior.

**Rationale:**
- Changes already merged, tested (2571 LOC of tests), and documented (eval-command.md)
- Spec creation here is retrospective documentation, not forward-looking requirements
- Reading implementation reveals actual behavior > guessing from commit messages

**Alternatives considered:**
- Write specs from scratch based on desired behavior → Wrong: code is already shipped
- Skip specs entirely → Violates OpenSpec discipline, creates technical debt

### **Decision 2: Separate specs for each new capability**

**Choice:** Create 4 new capability specs (figma-plugin-api, eval-command, app-menu, autosave) in `specs/<name>/spec.md`.

**Rationale:**
- Each is independently testable and documented
- Figma Plugin API is a 1119-line implementation with 924 LOC of tests — deserves standalone spec
- Aligns with OpenSpec principle: one capability = one spec

**Alternatives considered:**
- Merge figma-plugin-api and eval-command into single spec → No: API is usable beyond eval (e.g., AI tools)
- Put app-menu and autosave into existing editor-ui spec → No: loses discoverability

### **Decision 3: Delta specs for modified capabilities**

**Choice:** Create delta specs in `openspec/changes/sync-specs-docs-with-master/specs/<capability>/spec.md` for cli, tooling, testing, vitepress-docs.

**Rationale:**
- Requirements changed (CLI has new eval subcommand, testing has 5 new test suites)
- Delta specs eventually merge into main specs during archive phase
- Preserves change history and review trail

### **Decision 4: Update comparison docs to reflect eval + app menu**

**Choice:**
- Update `docs/guide/figma-comparison.md` → add rows for app menu (Interface section), eval command (Plugin API section), update AI tools row
- Update `docs/guide/comparison.md` → add paragraph in Architecture section highlighting headless scripting advantage over Penpot

**Rationale:**
- App menu brings OpenPencil closer to Figma's UI parity (updates Interface & Navigation section)
- Eval command with Figma Plugin API is unique differentiator (Penpot has no plugin API)
- Comparison matrices are user-facing landing page content → must stay current

**Alternatives considered:**
- Skip comparison updates → No: comparison.md is linked from README and landing page
- Only update Figma comparison → No: headless scripting is architectural advantage over Penpot too

### **Decision 5: Minimal AGENTS.md updates**

**Choice:** Update AGENTS.md only to reflect tool unification (reference `packages/core/src/tools/` instead of `src/ai/tools.ts`).

**Rationale:**
- AGENTS.md already mentions tool architecture
- Eval command, app menu, autosave don't change agent instructions
- Unified tool definitions reduce duplication → agents reference canonical source

## Risks / Trade-offs

**[Risk: Specs may drift from code again]** → Mitigation: Add note to CONTRIBUTING.md or AGENTS.md to update specs alongside code
**[Risk: Verbose specs for retrospective documentation]** → Mitigation: Focus on requirements/scenarios, not rehashing code structure
**[Trade-off: Delta specs add file count]** → Acceptable: OpenSpec workflow requires deltas for modified capabilities; they merge during archive

## Migration Plan

N/A — documentation-only changes. No deployment, rollback, or runtime impact.

## Open Questions

None — all implementation details are observable in merged code and tests.
