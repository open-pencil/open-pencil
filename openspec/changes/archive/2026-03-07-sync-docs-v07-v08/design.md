# Design: sync-docs-v07-v08

## Scope

Pure documentation update — no code changes. All edits are in `packages/docs/`.

## File inventory

### English (source of truth)

| File | Changes needed |
|------|----------------|
| `guide/features.md` | Add: SVG export, Copy/Paste as, stroke align + per-side, Mobile/PWA, Tailwind JSX export, Homebrew tap, layer rename, updated tool count (75→78), Google Fonts fallback, auto-save, profiler |
| `guide/architecture.md` | Add "What's Next" section: multi-file tabs, AI providers, code signing, .fig fidelity, full figma-use tool set, CI tools, prototyping, SVG/PDF export, CSS Grid (Yoga upstream) |
| `guide/comparison.md` | Update: scripting section (75→78 tools), Summary paragraph (78 tools), "What Penpot Does Better" remove SVG export as Penpot advantage |
| `guide/figma-comparison.md` | Fix: Rename layers 🟡→✅, Image/SVG export 🟡→✅ (SVG done), Copy/Paste as 🔲→✅, Tailwind JSX export (new row), Stroke align ✅ (new row), Per-side stroke weights ✅ (new row), AI tools count 75→78, MCP tools count 75→78 |
| `user-guide/exporting.md` | Add SVG to format table; add "Copy/Paste as" subsection with all 4 formats |
| `user-guide/drawing-shapes.md` | Add Stroke Align (Inside/Center/Outside); add per-side stroke weights |
| `user-guide/layers-and-pages.md` | Add double-click rename; mobile drawer note; Code tab format toggle |
| `user-guide/context-menu.md` | Add "Copy/Paste as" section with 4 formats + shortcuts |
| `reference/keyboard-shortcuts.md` | Fix: ⌘N/⌘T ✅, ⌘W ✅, ⌘\\ ✅; add ⇧⌘C ✅ |
| `reference/mcp-tools.md` | Expand all tool tables to full 78 tools |
| `guide/getting-started.md` | Add Homebrew section; add `bun run test:unit` to scripts table |

### Locale translations (DE, ES, FR, IT, PL)

| File | Locales | Notes |
|------|---------|-------|
| `guide/features.md` | DE, ES, FR, IT, PL | Full sync — add all new sections |
| `guide/comparison.md` | DE, ES, FR, IT, PL | Sync scripting/summary counts; DE needs major expansion (128→292 lines) |
| `guide/figma-comparison.md` | DE, ES, FR, IT, PL | Sync status changes (Rename ✅, SVG ✅, Copy/Paste as ✅, new rows) |
| `user-guide/exporting.md` | DE, ES, FR, IT, PL | Add SVG + Copy/Paste as |
| `user-guide/drawing-shapes.md` | DE, ES, FR, IT, PL | Add stroke align + per-side |
| `user-guide/layers-and-pages.md` | DE, ES, FR, IT, PL | Add rename, mobile note, Code tab |
| `user-guide/context-menu.md` | DE, ES, FR, IT, PL | Add Copy/Paste as section |

## Approach

1. Update EN files first (source of truth), in this order:
   - comparison tables (quick, factual fixes)
   - architecture.md "What's Next"
   - user-guide articles (exporting, drawing-shapes, layers, context-menu)
   - keyboard-shortcuts, mcp-tools, getting-started
   - features.md (comprehensive, last)
2. For each locale, apply the same changes translated into that language
3. Update spec delta files

## Key content decisions

### comparison.md updates
- Update scripting section: "75 tools" → "78 tools"; mention new analyze/diff tools
- Update summary paragraph tool count
- "What Penpot Does Better" section: remove "Server-side export" since OpenPencil now has SVG export; keep PDF as Penpot advantage
- Scale table: update rendering engine LOC from 1,646 to ~3,200 (split into 10 files)

### figma-comparison.md updates
- `Rename layers`: 🟡 (no inline rename UI) → ✅ (double-click inline rename added in Unreleased)
- `Image/SVG export`: 🟡 (no SVG) → ✅ (SVG export in v0.7.0)
- `Copy/Paste as`: add new row ✅
- `Tailwind CSS v4 export`: add new row in Code section ✅
- `Stroke align`: add new row ✅ in Effects & Properties
- `Individual stroke weights per side`: add new row ✅

### architecture.md "What's Next"
Content sourced from `plan.md` "What's next" section and CHANGELOG Unreleased:
- Multi-file / tabs (done in v0.5.0 — mark as complete if needed, or remove)
- More AI providers (Anthropic direct, Gemini, Ollama local models)
- Code signing (done for macOS in v0.6.0)
- .fig compatibility fidelity improvements
- Full figma-use tool set (currently 78/118)
- CI tools (design lint, visual regression via headless CLI)
- Prototyping (frame transitions, triggers, preview mode)
- CSS Grid layout (blocked on facebook/yoga#1893)
- SVG/PDF export (SVG done in v0.7.0, PDF planned)

## Spec deltas

### vitepress-docs/spec.md additions
- Comparison tables accuracy requirement
- Roadmap/What's Next section requirement
- figma-comparison.md status accuracy

### userdoc-articles/spec.md additions
- Stroke align and per-side weights
- Layer inline rename
- Copy/Paste as in context menu
- Mobile drawer note
- Locale parity
