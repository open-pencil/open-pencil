# Refactor Plan — Architecture Cleanup

## Status: DONE ✓

## 1. tools/schema.ts cleanup [P0] ✓
- Deleted all duplicate tool definitions from schema.ts: 1831 → 65 lines
- Fixed tools/index.ts to export ALL_TOOLS from registry
- Fixed renderJsx → renderJSX typo in create.ts and structure.ts

## 2. geometry.ts extraction [P0] ✓
- Created packages/core/src/geometry.ts with degToRad, radToDeg, rotatePoint, rotatedCorners, rotatedBBox
- Exported from core index.ts
- Consumer refactoring (snap.ts, kiwi-serialize.ts, use-canvas-input.ts) deferred — functions available for new code

## 3. renderer/ directory split [P1] ✓
- Split 3206-line renderer.ts into renderer/ directory (10 files)
- renderer.ts (1144) — class with delegations, constructor, render(), loadFonts(), surface mgmt
- overlays.ts (760) — selection, hover, snap, marquee, flashes, pen, remote cursors, text edit overlay
- scene.ts (490) — node rendering pipeline, effects, text
- rulers.ts (235) — ruler drawing and badges
- fills.ts (233) — fill application, gradients, images, arcs
- strokes.ts (221) — stroke drawing with alignment
- labels.ts (212) — section titles and component labels
- shapes.ts (193) — path/shape creation and geometry caching
- effects.ts (64) — image/mask filter caching

## 4. isMixed() helper [P1] ✓
- Added isArrayMixed() to use-multi-props.ts
- Deduplicated FillSection, StrokeSection, EffectsSection (each lost 4 lines of boilerplate)

## 5. Test imports cleanup ✓
- All tests now use `@open-pencil/core` instead of relative paths into packages/core/src/
- Merged duplicate import statements across all test files
- Fixed 3 broken test imports (stale paths to src/engine/ and src/kiwi/)
- Exported profiler internals and style-run helpers from core index.ts

## 6. Test coverage [P0-P1] ✓
New test files (98 new tests, 683 total → all green):
- color.test.ts — parseColor, colorToHex, colorToCSS (14 tests)
- undo.test.ts — UndoManager apply/push/undo/redo/batch/clear (12 tests)
- snap.test.ts — computeSnap, computeSelectionBounds (9 tests)
- vector.test.ts — vectorNetworkBlob round-trip, computeVectorBounds (10 tests)
- style-runs.test.ts — toggleBold/Italic/Decoration, adjustRuns, applyStyle (18 tests)
- text-editor.test.ts — insert/delete/cursor/selection/word ops (25 tests)

## 7. Bug fixes (found during audit) ✓
- renderJsx → renderJSX typo in tools/create.ts and tools/structure.ts
- 3 broken test file imports (stale paths after monorepo reorganization)

## Future work (not in this batch)
- Refactor consumers to use geometry.ts (snap.ts, kiwi-serialize.ts, use-canvas-input.ts)
- Split editor.ts store into sub-composables (~2184 lines, 91 functions)
- Split use-canvas-input.ts drag handlers (~1298 lines)
- Unify decompress utilities (kiwi-serialize.ts vs kiwi/codec.ts)
