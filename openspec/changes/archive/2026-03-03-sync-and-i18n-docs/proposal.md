## Why

Master advanced significantly: P2P collaboration, MCP server package, multi-file tabs, 29 tools, performance optimizations, effects rendering fixes. Specs are out of sync. Additionally, the documentation site has no translations — adding German, Italian, French, Spanish, and Polish expands the audience.

## What Changes

- Update OpenSpec specs to reflect master changes (collab, MCP, multi-tabs, performance, effects)
- Update Figma comparison matrix (multiplayer ✅, MCP ✅, CLI ✅, stats recalculated)
- Add VitePress i18n: translate user-facing docs to de, it, fr, es, pl
- Configure VitePress locales in config.ts

## Capabilities

### New Capabilities
- `docs-i18n`: VitePress internationalization with 5 language directories and locale config

### Modified Capabilities
- `vitepress-docs`: add i18n config, locale switcher
- `tooling`: add MCP package to workspace listing

## Impact

- **Docs:** ~145 new translated md files (29 pages × 5 languages)
- **Config:** packages/docs/.vitepress/config.ts locale setup
- **Specs:** updates to reflect P2P collab, MCP, multi-tabs, effects, performance
