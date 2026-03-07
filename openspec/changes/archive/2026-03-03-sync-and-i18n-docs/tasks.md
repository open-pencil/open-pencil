## Context

Sync with master (P2P collab, MCP, multi-tabs, 29 tools, perf) already done via merge. This change adds i18n translations and updates specs.

## 1. Configure VitePress i18n

- [x] 1.1 Add `locales` config to `packages/docs/.vitepress/config.ts` with root (en), de, it, fr, es, pl — each with label, lang, nav, and sidebar translations

## 2. Translate docs — German (de)

- [x] 2.1 Create `packages/docs/de/` with translated: index.md, guide/ (6 pages), user-guide/ (12 pages) — 19 files

## 3. Translate docs — Italian (it)

- [x] 3.1 Create `packages/docs/it/` with same 19 translated files

## 4. Translate docs — French (fr)

- [x] 4.1 Create `packages/docs/fr/` with same 19 translated files

## 5. Translate docs — Spanish (es)

- [x] 5.1 Create `packages/docs/es/` with same 19 translated files

## 6. Translate docs — Polish (pl)

- [x] 6.1 Create `packages/docs/pl/` with same 19 translated files

## 7. Verification

- [x] 7.1 Run `cd packages/docs && bun run build` — verify no dead links across all locales
- [x] 7.2 Verify language switcher works in dev mode
