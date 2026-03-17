# Refactoring Roadmap

Status of all items from the codebase audit.

## 🔴 Critical (Architectural Debt)

### 1. `src/stores/editor.ts` — was 2,505 lines

**Status:** ✅ Done — extracted to `packages/core/src/editor/` (15 modules). App store is 570 lines, spreads `Editor` + adds file I/O, export, flash effects.

### 2. `src/composables/use-canvas-input.ts` — was 1,501 lines

**Status:** ✅ Done — split into 5 modules in `packages/vue/src/input/` (types, geometry, pan-zoom, resize, auto-layout). Orchestrator: 815 lines.

### 3. State is fully mutable to all consumers

**Status:** 🔜 Deferred — `shallowReadonly` + setter methods. Low priority since SDK composables now type against `Editor` not raw state.

## 🟡 Medium (Code Quality)

### 4. Fire-and-forget async calls — 10+ unhandled

**Status:** 🔜 Deferred — needs `safeFire()` helper.

### 5. Module-level state in composables

**Status:** 🔜 Deferred — `use-chat.ts` and `use-menu.ts` are app-specific, low urgency.

### 6. Bounding-box computation duplicated ~10 times

**Status:** ✅ Done — `computeBounds()` added to geometry.ts. snap.ts deduplicated with `rotatedBBox()`.

### 7. "Node not found" guard repeated 44 times in tools

**Status:** ✅ Partially done — `requireNode()` + `NodeNotFoundError` added to tools/schema.ts. Tool-by-tool adoption is incremental.

### 8. Barrel import overuse

**Status:** 🔜 Deferred — gradual migration to subpath imports.

### 9. `kiwi-serialize.ts` misplaced

**Status:** ✅ Done — moved to `packages/core/src/kiwi/kiwi-serialize.ts`.

### 10. `tools/stock-photo.ts` throws instead of returning `{ error }`

**Status:** ✅ Already correct — exports use `return { error }`, throws are internal only.

## 🟢 Low Priority (Polish)

### 11. Large Vue components (8 over 300 lines)

**Status:** 🔜 Deferred — split incrementally.

### 12. Icon import bloat

**Status:** 🔜 Deferred.

### 13. Unscoped `<style>` in `CodePanel.vue`

**Status:** ✅ Done — scoped.

### 14. Dead exports

**Status:** ✅ Done — removed `createPropertyChange` from undo.ts, un-exported `queryFonts`/`FontInfo` from fonts.ts. `copy*` functions kept (tested).

### 15. Renderer circular imports

**Status:** ✅ Not actionable — type-only imports, no runtime cycles.

### 16. Duplicate font weight maps

**Status:** ✅ Done — single `FONT_WEIGHT_NAMES` in fonts.ts, figma-api-proxy.ts imports from there.

### 17. Rotated corners reimplemented

**Status:** ✅ Done — snap.ts now uses `rotatedBBox()` from geometry.ts. overlays.ts kept (different — screen coords).

### 18. Duplicate .fig scaffold/zip assembly

**Status:** ✅ Done — zip assembly extracted to `fig-compress.ts`. DOCUMENT scaffold intentionally different (clipboard vs full export).

### 19. Group/Frame/Component/ComponentSet creation — 4× copy-paste

**Status:** ✅ Already fixed — `wrapSelectionInContainer()` in structure.ts handles all 4 types.

### 20. `console.warn`/`console.error` (30 total)

**Status:** 🔜 Deferred — all legitimate error handlers, structured logger is a nice-to-have.

## Additional work completed

- **vue-tsc errors**: Fixed all 135, now a check gate (was never checked before)
- **`@open-pencil/vue` SDK**: Headless package with 8 composables, 6 renderless components
- **Editor variable actions**: 7 undo-able CRUD operations, wired into VariablesDialog
- **Editor alignment actions**: alignNodes, flipNodes, rotateNodes, wired into PositionSection
- **`updateNodeWithUndo` auto-renders**: eliminated 15+ redundant requestRender() calls
- **Merged `useNodeProps` + `useMultiProps`**: single composable, no duplicate computed refs
- **`toolCursor()` utility**: replaces if/else chain
- **`toast.ts` rename**: singleton module, not a composable
- **`computeBounds()` utility**: bounding box helper in geometry.ts
- **`requireNode()` helper**: for tool guard patterns
- **`tsgo --noEmit`**: added to check script
- **EditorStore simplified**: spreads Editor instead of listing 80+ methods manually
