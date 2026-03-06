# Contributing

## Setup

```bash
git clone https://github.com/open-pencil/open-pencil.git
cd open-pencil
bun install
```

## Development

```bash
bun run dev          # Vite dev server on localhost:1420
bun run tauri dev    # Tauri desktop app with hot reload
```

## Quality checks

Run all of these before submitting a PR:

```bash
bun run check        # oxlint + typecheck
bun run format       # oxfmt with import sorting
bun run test:dupes   # jscpd < 3% duplication
bun run test:unit    # bun:test (tests/engine/)
bun run test         # Playwright E2E (auto-starts dev server)
```

## Project structure

- `packages/core` — scene graph, renderer, layout, codec (zero DOM deps)
- `packages/cli` — headless CLI for .fig inspection and export
- `packages/mcp` — MCP server for AI tools (stdio + HTTP)
- `packages/acp` — ACP (Agent Client Protocol) server
- `packages/docs` — VitePress documentation site (openpencil.dev)
- `src/` — Tauri/Vite desktop editor

## Conventions

See [`AGENTS.md`](./AGENTS.md) for the full architecture reference, code conventions, and quality checklist. Key points:

- Bun runtime, not Node
- Tailwind 4 for styles, no inline CSS or `<style>` blocks
- No `any`, no `!` non-null assertions
- `@/` import alias for app code, relative imports within core
- Use `crypto.getRandomValues()`, never `Math.random()`
- Icons via unplugin-icons (`<icon-lucide-*>`)
- Use existing deps and Reka UI components before hand-rolling (see AGENTS.md → Code quality)

## Test IDs (`data-test-id`)

Every interactive or structurally significant element must have a `data-test-id` attribute. These are used by Playwright E2E tests and must follow the naming convention below.

### Naming rules

- **kebab-case**, all lowercase
- Pattern: `{component}-{element}` or `{component}-{element}-{variant}`
- Mobile counterparts are prefixed with `mobile-`
- Dynamic IDs use template literals: `` :data-test-id="`toolbar-tool-${key.toLowerCase()}`" ``

### Nomenclature

| Prefix | Component | Examples |
|--------|-----------|---------|
| `toolbar-` | Desktop toolbar | `toolbar`, `toolbar-tool-select`, `toolbar-flyout-frame`, `toolbar-flyout-item-ellipse` |
| `mobile-toolbar-` | Mobile toolbar | `mobile-toolbar`, `mobile-toolbar-prev`, `mobile-toolbar-next`, `mobile-toolbar-tool-select`, `mobile-toolbar-flyout-frame`, `mobile-toolbar-copy`, `mobile-toolbar-front` |
| `mobile-toolbar-tools` | Mobile tools category | Container for drawing tools |
| `mobile-toolbar-edit` | Mobile edit category | Container for edit actions (copy, paste, cut, duplicate, delete) |
| `mobile-toolbar-arrange` | Mobile arrange category | Container for arrange actions (front, back, group, ungroup, lock) |
| `mobile-drawer-` | Mobile bottom drawer | `mobile-drawer`, `mobile-drawer-handle`, `mobile-drawer-pages`, `mobile-drawer-content`, `mobile-drawer-layers`, `mobile-drawer-design`, `mobile-drawer-code`, `mobile-drawer-ai` |
| `mobile-ribbon-` | Mobile bottom tab bar | `mobile-ribbon`, `mobile-ribbon-layers`, `mobile-ribbon-design`, `mobile-ribbon-code`, `mobile-ribbon-ai` |
| `layers-` | Layers panel | `layers-panel`, `layers-header`, `layers-tree`, `layers-item` |
| `pages-` | Pages panel | `pages-panel`, `pages-header`, `pages-item`, `pages-item-input`, `pages-add` |
| `properties-` | Properties panel | `properties-panel`, `properties-tab-design`, `properties-tab-code`, `properties-tab-ai`, `properties-zoom` |
| `design-` | Design tab | `design-node-header`, `design-multi-header`, `design-panel-single`, `design-panel-multi`, `design-panel-empty` |
| `position-` | Position section | `position-section`, `position-align-left`, `position-flip-horizontal`, `position-rotate-90` |
| `layout-` | Layout section | `layout-section`, `layout-add-auto`, `layout-remove-auto`, `layout-direction-horizontal` |
| `fill-` | Fill section | `fill-section`, `fill-section-add`, `fill-item` |
| `stroke-` | Stroke section | `stroke-section`, `stroke-section-add`, `stroke-item` |
| `effects-` | Effects section | `effects-section`, `effects-section-add`, `effects-item` |
| `export-` | Export section | `export-section`, `export-section-add`, `export-button`, `export-item` |
| `typography-` | Typography section | `typography-section`, `typography-missing-font` |
| `variables-` | Variables | `variables-section`, `variables-dialog`, `variables-add-variable` |
| `context-` | Context menu | `context-copy`, `context-paste`, `context-delete`, `context-group` |
| `color-` | Color picker | `color-picker-popover`, `color-picker-swatch`, `color-hex-input` |
| `fill-picker-` | Fill picker | `fill-picker-swatch`, `fill-picker-tab-solid`, `fill-picker-tab-gradient` |
| `font-picker-` | Font picker | `font-picker-trigger`, `font-picker-search`, `font-picker-item` |
| `chat-` | Chat / AI panel | `chat-panel`, `chat-input`, `chat-send-button`, `chat-messages` |
| `code-` | Code panel | `code-panel`, `code-panel-header`, `code-panel-copy` |
| `collab-` | Collaboration | `collab-popover`, `collab-share-button`, `collab-copy-link` |
| `canvas-` | Canvas | `canvas-area`, `canvas-element`, `canvas-loading` |
| `editor-` | Editor root | `editor-root`, `editor-document-name`, `editor-show-ui` |
| `app-` | App chrome | `app-logo`, `app-document-name`, `app-toggle-ui`, `app-select-trigger` |
| `tabbar-` | Tab bar | `tabbar-tab`, `tabbar-new`, `tabbar-close` |
| `scrub-input` | Scrub input | `scrub-input`, `scrub-input-field` |
| `toast-` | Toast notifications | `toast-item`, `toast-close`, `toast-copy-error` |
| `safari-banner` | Safari warning | `safari-banner`, `safari-banner-dismiss` |

## Test fixtures

`.fig` fixtures in `tests/fixtures/` are Git LFS. Use `git push --no-verify` to skip the slow LFS pre-push hook unless you changed `.fig` files.

## Commits

Follow the existing style in `git log`. Keep messages concise. Update `CHANGELOG.md` for user-facing changes.
