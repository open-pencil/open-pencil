# Proposal: sync-docs-v07-v08

## Problem

The VitePress documentation site (`packages/docs/`) has diverged significantly from the codebase since the last docs sync (commit `8a486d5`). Over 100 commits landed in master after that point, introducing major features:

- **SVG export** (v0.7.0) — new format in Export panel, CLI, MCP
- **Copy/Paste as submenu** — Copy as text / SVG / PNG / JSX
- **Stroke align + individual strokes** — Inside/Center/Outside, per-side weights
- **Google Fonts fallback** — auto-loads fonts from Google Fonts API
- **Auto-save toggle** — File → Auto-save to local file
- **Renderer profiler** — HUD overlay, GPU timing (View menu)
- **Mobile layout + PWA** — responsive editor, swipeable drawer, installable PWA
- **Tailwind CSS v4 JSX export** — new Code panel format toggle
- **Homebrew tap** — `brew install open-pencil/tap/open-pencil`
- **Double-click to rename layers** — inline rename in layers panel
- **9 new AI/MCP tools** — analyze_colors, analyze_typography, analyze_spacing, analyze_clusters, diff_create, diff_show, get_components, get_current_page, arrange, node_to_component
- **⌘N / ⌘T new tab, ⌘W close tab** — previously marked 🔲 in keyboard shortcuts
- **⌘\\ Toggle UI** — previously marked 🔲

Additionally:

- **Comparison tables outdated** — `comparison.md` (vs Penpot) and `figma-comparison.md` use stale counts (75 tools vs 78 actual, Rename layers 🟡 should be ✅, Image/SVG export 🟡 should be ✅ for SVG). The DE locale comparison is severely truncated (128 lines vs 292 EN).
- **No "What's next" / roadmap section** — `guide/architecture.md` documents current state but has no future plans. `plan.md` has a rich "What's next" section that should be surfaced in docs.
- **All locale translations** (DE, ES, FR, IT, PL) are 40–80 lines shorter than EN and missing every feature added since v0.5.0.
- **MCP tools reference** counts 75 tools but the table only lists ~25 entries; new tools are undocumented.

## What changes

1. **EN docs** — update `features.md`, `exporting.md`, `drawing-shapes.md`, `layers-and-pages.md`, `context-menu.md`, `reference/keyboard-shortcuts.md`, `reference/mcp-tools.md`, `guide/getting-started.md`, `guide/architecture.md`
2. **Comparison tables** — update `guide/comparison.md` (tool counts, scripting section, summary) and `guide/figma-comparison.md` (Rename layers ✅, SVG export ✅, Copy/Paste as ✅, Tailwind export, stroke align/per-side)
3. **Roadmap** — add "What's Next" section to `guide/architecture.md` drawn from `plan.md`
4. **Locale translations** — full sync for DE, ES, FR, IT, PL: `features.md`, `exporting.md`, `drawing-shapes.md`, `layers-and-pages.md`, `context-menu.md`, `comparison.md`, `figma-comparison.md`
5. **Spec deltas** — update `vitepress-docs/spec.md` and `userdoc-articles/spec.md`

## Why now

The branch `add-vitepress-docs` just pulled in master (e828185). This is the ideal moment to sweep through every doc page and make it accurate before the branch is merged or published.
