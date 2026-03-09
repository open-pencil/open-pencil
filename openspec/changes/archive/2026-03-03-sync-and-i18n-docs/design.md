## Context

Retrospective sync + i18n expansion. Code merged, specs stale. VitePress i18n uses directory-per-locale pattern.

## Goals / Non-Goals

**Goals:** Sync specs, add 5 translations to docs site.
**Non-Goals:** Translate reference/development pages (too technical). Translate specs. Code changes.

## Decisions

1. **Translate user-guide + guide pages only** — reference and development pages stay English-only (code examples, API docs don't benefit from translation).
2. **VitePress directory-per-locale** — `de/`, `it/`, `fr/`, `es/`, `pl/` under `packages/docs/`. Root stays English.
3. **Sidebar and nav translations** — each locale gets translated sidebar labels and nav items in config.ts.
4. **Pages to translate per locale** (17 pages): index.md, guide/getting-started.md, guide/features.md, guide/comparison.md, guide/architecture.md, guide/tech-stack.md, guide/figma-comparison.md, user-guide/index.md, user-guide/canvas-navigation.md, user-guide/selection-and-manipulation.md, user-guide/drawing-shapes.md, user-guide/text-editing.md, user-guide/pen-tool.md, user-guide/layers-and-pages.md, user-guide/context-menu.md, user-guide/exporting.md, user-guide/auto-layout.md, user-guide/components.md, user-guide/variables.md.
