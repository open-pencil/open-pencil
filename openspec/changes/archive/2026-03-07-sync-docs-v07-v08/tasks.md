# Tasks: sync-docs-v07-v08

## 1. English — comparison tables

- [x] 1.1 `guide/comparison.md` — update scripting section: "75 tools" → "78 tools", mention analyze_*/diff_* tools; update Summary paragraph tool counts; remove "Server-side export" from "What Penpot Does Better" (OpenPencil now has SVG export); update rendering engine LOC (~3,200 after renderer split)
- [x] 1.2 `guide/figma-comparison.md` — fix statuses: Rename layers 🟡→✅, Image/SVG export 🟡→✅; add new rows: Copy/Paste as ✅, Tailwind CSS v4 export ✅, Stroke align ✅, Individual stroke weights per side ✅; update AI/MCP tool counts 75→78; update Coverage line count

## 2. English — architecture roadmap

- [x] 2.1 `guide/architecture.md` — add "What's Next" section after the last component section, drawn from `plan.md` and CHANGELOG Unreleased: more AI providers (Anthropic direct, Gemini, Ollama), full figma-use tool set (78/118 currently), CI design lint + visual regression, Prototyping (phase 6), CSS Grid (blocked on facebook/yoga#1893), SVG/PDF export (SVG ✅, PDF planned), .fig fidelity improvements

## 3. English — user guide articles

- [x] 3.1 `user-guide/exporting.md` — add SVG to format table (note: no scale selector for SVG); add "Copy/Paste as" subsection with: Copy as text, Copy as SVG, Copy as PNG (⇧⌘C / Shift+Ctrl+C), Copy as JSX
- [x] 3.2 `user-guide/drawing-shapes.md` — add "Stroke Align" subsection under Shape Properties (Inside/Center/Outside, clip-based rendering); add "Per-Side Stroke Weights" note (Top/Right/Bottom/Left dropdown)
- [x] 3.3 `user-guide/layers-and-pages.md` — add double-click inline rename in Layers Panel section (blur/Enter/Escape to commit); add mobile bottom drawer note; update Code tab description: mention format toggle (OpenPencil JSX / Tailwind CSS v4)
- [x] 3.4 `user-guide/context-menu.md` — add "Copy/Paste as" section: Copy as text, Copy as SVG, Copy as PNG (⇧⌘C), Copy as JSX

## 4. English — reference pages

- [x] 4.1 `reference/keyboard-shortcuts.md` — fix File section: ⌘N ✅, ⌘T ✅, ⌘W ✅; fix View section: ⌘\\ ✅; add Edit section row: ⇧⌘C Copy as PNG ✅
- [x] 4.2 `reference/mcp-tools.md` — expand all tool tables to full 78 tools; add missing categories/tools: Granular Set (set_rotation, set_opacity, set_radius, set_minmax, set_text, set_font, set_font_range, set_text_resize, set_visible, set_blend, set_locked, set_stroke_align), Node ops (node_bounds, node_move, node_resize, node_ancestors, node_children, node_tree, node_bindings, node_replace_with), Variables (get_variable, find_variables, create_variable, set_variable, delete_variable, bind_variable, get_collection, create_collection, delete_collection), Boolean (boolean_union, boolean_subtract, boolean_intersect, boolean_exclude), Vector (path_get, path_set, path_scale, path_flip, path_move), Create extras (create_page, create_vector, create_slice), Analyze (analyze_colors, analyze_typography, analyze_spacing, analyze_clusters), Diff (diff_create, diff_show), Arrange (arrange), Component (node_to_component, get_components, get_current_page)
- [x] 4.3 `guide/getting-started.md` — add Homebrew install section before "Building from Source": `brew install open-pencil/tap/open-pencil`; add `bun run test:unit` row to scripts table

## 5. English — features.md

- [x] 5.1 `guide/features.md` — add/update sections: SVG Export (v0.7.0), Copy/Paste as submenu, Stroke Align + Per-Side Weights, Google Fonts Fallback, Auto-Save Toggle, Renderer Profiler, Mobile Layout & PWA, Tailwind CSS v4 JSX Export, Homebrew Tap, Layer Inline Rename; update AI Chat tools count (75→78); update MCP total (78 tools); update Code Panel: mention format toggle

## 6. German translation (de/)

- [x] 6.1 `de/guide/comparison.md` — full expansion to match EN (128→~290 lines): restore all missing sections (Rendering Pipeline detail, Scene Graph, Layout Engine, File Format, State & Undo, Developer Experience, Performance, What Penpot Does Better, Scripting, full Summary table); update tool counts and SVG export status
- [x] 6.2 `de/guide/figma-comparison.md` — sync status changes: Rename layers ✅, SVG export ✅; add new rows: Copy/Paste as, Tailwind, Stroke align, Per-side weights; update coverage line
- [x] 6.3 `de/guide/features.md` — add all new sections from EN (SVG export, Copy/Paste as, stroke align, mobile/PWA, Tailwind, Homebrew, layer rename, Google Fonts, auto-save, profiler); update tool counts
- [x] 6.4 `de/user-guide/exporting.md` — add SVG format + Copy/Paste as subsection
- [x] 6.5 `de/user-guide/drawing-shapes.md` — add stroke align + per-side weights
- [x] 6.6 `de/user-guide/layers-and-pages.md` — add rename, mobile note, Code tab format toggle
- [x] 6.7 `de/user-guide/context-menu.md` — add Copy/Paste as section

## 7. Spanish translation (es/)

- [x] 7.1 `es/guide/comparison.md` — update scripting/summary tool counts; SVG export status fix
- [x] 7.2 `es/guide/figma-comparison.md` — sync status changes + add new rows
- [x] 7.3 `es/guide/features.md` — add all new sections from EN
- [x] 7.4 `es/user-guide/exporting.md` — add SVG format + Copy/Paste as
- [x] 7.5 `es/user-guide/drawing-shapes.md` — add stroke align + per-side weights
- [x] 7.6 `es/user-guide/layers-and-pages.md` — add rename, mobile, Code tab
- [x] 7.7 `es/user-guide/context-menu.md` — add Copy/Paste as section

## 8. French translation (fr/)

- [x] 8.1 `fr/guide/comparison.md` — update scripting/summary tool counts; SVG export status fix
- [x] 8.2 `fr/guide/figma-comparison.md` — sync status changes + add new rows
- [x] 8.3 `fr/guide/features.md` — add all new sections from EN
- [x] 8.4 `fr/user-guide/exporting.md` — add SVG format + Copy/Paste as
- [x] 8.5 `fr/user-guide/drawing-shapes.md` — add stroke align + per-side weights
- [x] 8.6 `fr/user-guide/layers-and-pages.md` — add rename, mobile, Code tab
- [x] 8.7 `fr/user-guide/context-menu.md` — add Copy/Paste as section

## 9. Italian translation (it/)

- [x] 9.1 `it/guide/comparison.md` — update scripting/summary tool counts; SVG export status fix
- [x] 9.2 `it/guide/figma-comparison.md` — sync status changes + add new rows
- [x] 9.3 `it/guide/features.md` — add all new sections from EN
- [x] 9.4 `it/user-guide/exporting.md` — add SVG format + Copy/Paste as
- [x] 9.5 `it/user-guide/drawing-shapes.md` — add stroke align + per-side weights
- [x] 9.6 `it/user-guide/layers-and-pages.md` — add rename, mobile, Code tab
- [x] 9.7 `it/user-guide/context-menu.md` — add Copy/Paste as section

## 10. Polish translation (pl/)

- [x] 10.1 `pl/guide/comparison.md` — update scripting/summary tool counts; SVG export status fix
- [x] 10.2 `pl/guide/figma-comparison.md` — sync status changes + add new rows
- [x] 10.3 `pl/guide/features.md` — add all new sections from EN
- [x] 10.4 `pl/user-guide/exporting.md` — add SVG format + Copy/Paste as
- [x] 10.5 `pl/user-guide/drawing-shapes.md` — add stroke align + per-side weights
- [x] 10.6 `pl/user-guide/layers-and-pages.md` — add rename, mobile, Code tab
- [x] 10.7 `pl/user-guide/context-menu.md` — add Copy/Paste as section

## 11. Spec updates

- [x] 11.1 `openspec/specs/vitepress-docs/spec.md` — merge delta spec requirements (comparison accuracy, roadmap section, figma-comparison accuracy)
- [x] 11.2 `openspec/specs/userdoc-articles/spec.md` — merge delta spec requirements (stroke align, rename, copy/paste as, mobile, locale parity)
