# MCP Codegen Pipeline — Implementation Plan

## What's Done

Branch `feat/mcp-codegen` (off `57eaf87`).

### New Files

- `packages/core/src/tools/codegen.ts` — 3 MCP tools:
  - `design_to_tokens` — extracts Figma variables as CSS/Tailwind/JSON, resolves aliases, handles multi-mode
  - `design_to_component_map` — analyzes document for screens, components (variants, props, instance counts), dependency overview
  - `get_codegen_prompt` — returns the codegen system prompt (lazy `await import('node:fs/promises')` to avoid Vite browser externalization error)
- `packages/core/src/tools/prompts/codegen.md` — 5-step workflow prompt (~8KB):
  1. Survey (page tree, components, variables, colors, typography, spacing)
  2. Decompose (clusters, describe, get_jsx → component map)
  3. Extract tokens (stack-aware: Tailwind → only semantic color CSS vars; CSS → full vars)
  4. Generate code (bottom-up, one file per component, interactive states)
  5. Verify (re-check against design)
- `packages/core/src/tools/registry.ts` — 3 tools registered in `ALL_TOOLS` (now 91 total)
- `docs/design-to-code-overview.md` — architecture overview

### Design Decisions

- **No MCP server instructions** — prompt delivered via `get_codegen_prompt` tool only (no 8KB overhead per request)
- **Lazy fs import** — `await import('node:fs/promises')` inside function body to avoid Vite `Module "node:fs" has been externalized` crash in browser bundle
- **Tailwind token strategy** — CSS custom properties only for semantic colors; Tailwind utilities for spacing/font/radius (avoids `--font-bold`, `--text-sm` conflicts with Tailwind v4 internals)
- **No modifications to existing tools** — `get_jsx`, `describe`, `analyze_*` used as-is

### Tested

- MCP HTTP server (`http://127.0.0.1:3100/mcp`) — all 3 new tools callable
- End-to-end with `lol.fig` (Movie Card, 390×1823, Inter font, dark theme, 164 nodes):
  - Full pipeline: survey → decompose → tokens → generate → verify
  - Generated 10 Vue 3 + Tailwind components + semantic color tokens
  - Visual test in just-bun dev server

## What's Left

### Phase 1 — Tailwind HTML Export (high value, low effort)

Add `format` parameter to `get_jsx` tool:
- `"openpencil"` (default) — current round-trip JSX
- `"tailwind"` — HTML with Tailwind v4 utility classes

The renderer already exists (`export-jsx.ts` → `collectTailwindClasses`), just not exposed through the tool params. One change in `read.ts`.

This gives the LLM ready-to-use HTML with correct Tailwind classes directly from MCP — drastically reduces hallucination in generated code.

### Phase 2 — Prompt Improvements

- [ ] **Multi-file output format** — prompt should specify how to structure output when generating multiple files (fenced blocks with filenames)
- [ ] **Framework adapters** — framework-specific sections in prompt (Vue `<script setup>` boilerplate, React hooks patterns, Svelte `$props()`)
- [ ] **Image handling** — prompt guidance on when to use `export_svg` vs `export_png`, how to reference assets in generated code
- [ ] **Responsive** — breakpoint detection from frame widths, responsive class generation

### Phase 3 — Advanced Tools

- [ ] **`design_to_html`** — full page HTML + Tailwind from a frame, using the existing tailwind renderer + semantic grouping. Essentially `get_jsx format=tailwind` but with smarter HTML tag selection (nav, header, main, section, article, button)
- [ ] **`design_to_styles`** — extract complete stylesheet (CSS custom properties for all tokens, not just Figma variables but also inferred from analyze_colors/typography)
- [ ] **`compare_design_code`** — given generated code and node ID, produce a diff of what's missing or wrong

### Phase 4 — Integration

- [ ] Pi skill for open-pencil MCP (`~/.pi/agent/skills/open-pencil/SKILL.md`) — DONE, needs testing with real workflow
- [ ] VS Code extension integration — connect open-pencil MCP to the extension's AI chat
- [ ] Batch mode — process multiple frames/pages in one go

## Architecture

```
┌─────────────────────┐
│   AI Agent (LLM)    │
│                     │
│  reads codegen.md   │
│  calls MCP tools    │
│  generates code     │
└─────────┬───────────┘
          │ MCP (HTTP SSE)
┌─────────▼───────────┐
│   MCP Server        │
│   :3100/mcp         │
├─────────────────────┤
│ Survey tools        │  get_page_tree, get_components,
│                     │  list_variables, list_collections,
│                     │  analyze_colors, analyze_typography,
│                     │  analyze_spacing
├─────────────────────┤
│ Decompose tools     │  analyze_clusters, describe, get_jsx,
│                     │  design_to_component_map
├─────────────────────┤
│ Token tools         │  design_to_tokens, list_variables
├─────────────────────┤
│ Codegen tools       │  get_codegen_prompt, export_svg
├─────────────────────┤
│ Core                │  .fig parser, scene graph, renderers
└─────────────────────┘
```
