## Why

After merging changes from master, OpenSpec specs and VitePress documentation are out of sync with the codebase. Major new features (Figma Plugin API, eval command, app menu, autosave) and architectural improvements (unified tool definitions) are implemented but not documented in specs or user-facing docs. This creates a gap between code reality and documentation, reducing project maintainability and developer understanding.

## What Changes

- Add specs for Figma Plugin API (1119-line implementation mirroring Figma's plugin surface)
- Add specs for `eval` CLI command (headless scripting with `--code`, `--stdin`, `--write`)
- Add specs for app menu bar (browser mode: File, Edit, View, Object, Text, Arrange)
- Add specs for autosave (debounced write 3s after scene changes)
- Update CLI spec with eval command integration
- Update tooling spec with unified tool definition system (define once, adapt for AI/CLI/MCP)
- Update testing spec with app menu and autosave integration tests
- Add VitePress documentation for eval command (comprehensive guide with examples)
- Update AGENTS.md references to reflect new tool architecture
- Update Figma comparison matrix (docs/guide/figma-comparison.md) to reflect new capabilities (app menu, CLI eval command, Figma Plugin API compatibility)
- Update Penpot comparison (docs/guide/comparison.md) to highlight headless scripting advantage

## Capabilities

### New Capabilities

- `figma-plugin-api`: Figma-compatible Plugin API for headless scripting. Provides `figma` global object with node creation, manipulation, querying, and serialization matching Figma's surface. Includes SceneNode proxy wrappers, property getters/setters, type guards, and JSON export.
- `eval-command`: CLI command `open-pencil eval <file> --code '<js>'` for executing JavaScript against .fig files. Supports stdin input, writing changes back, and returning JSON results. Enables batch operations, AI tool execution, and headless testing.
- `app-menu`: Browser mode menu bar with File (New, Open, Save, Export), Edit (Undo, Redo, Cut, Copy, Paste), View (Zoom controls, Rulers), Object (Group, Frame, Component), Text (Font size, Bold, Align), and Arrange (Bring to Front, Send to Back) menus. Only visible in browser (`!IS_TAURI`).
- `autosave`: Automatic file saving with 3-second debounce after last scene change. Watches `sceneVersion`, uses `useDebounceFn` from VueUse, writes via Tauri or File System Access API. Disabled for new unsaved files (no fileHandle).

### Modified Capabilities

- `cli`: Add eval command to CLI suite. Integrates FigmaAPI execution environment, supports `--write`/`-o` for persisting changes, `--stdin` for multiline scripts, `--json` for structured output.
- `tooling`: Unified tool definitions in `packages/core/src/tools/`. Define tools once in `schema.ts`, adapt for AI (`ai-adapter.ts`), CLI (citty commands), and MCP (future). Deduplicates 311 lines from `src/ai/tools.ts` by using `FigmaAPI.toJSON()` and shared color parsing.
- `testing`: Add integration tests for app menu (`tests/e2e/app-menu.spec.ts`, 131 lines) and autosave (`tests/e2e/autosave.spec.ts`, 113 lines). Add eval CLI tests (`tests/engine/eval-cli.test.ts`, 202 lines), FigmaAPI tests (`tests/engine/figma-api.test.ts`, 924 lines), and tool adapter tests (409 lines across 3 files).
- `vitepress-docs`: Add `docs/eval-command.md` (437 lines) covering eval architecture, FigmaAPI surface, usage examples, AI integration, testing patterns, and migration from Figma plugins.

## Impact

- **Core:** New `packages/core/src/figma-api.ts` (1119 lines), `packages/core/src/tools/` (3 files, 936 lines)
- **CLI:** New `packages/cli/src/commands/eval.ts` (78 lines)
- **Editor:** New `src/components/AppMenu.vue` (196 lines), modified `src/stores/editor.ts` (autosave logic)
- **Tests:** 5 new test files (2571 lines total)
- **Docs:** New `docs/eval-command.md`, updated AGENTS.md
- **Breaking:** None (additive changes only)
