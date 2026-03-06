## Context

PR #27 introduced mobile UI components that duplicated utilities and magic numbers already present elsewhere, used hand-rolled dropdowns instead of reka-ui, and used overly-wide types. All changes are purely refactoring/convention fixes — no new features.

## Goals / Non-Goals

**Goals:**
- Eliminate code duplication flagged in review
- Follow project conventions (reka-ui, constants file, store types, useBreakpoints)
- Fix PWA dev-mode caching bug

**Non-Goals:**
- Changing any mobile UX behavior
- Refactoring LayerTree/LayersPanel merge (too large, separate task)

## Decisions

**`colorToCSS` → `packages/core/src/color.ts`**: Composes with existing `colorToRgba255` — single implementation, zero duplication. Both `CollabPanel` and `MobileHud` import from core.

**`initials` → `src/utils/text.ts`**: App-level utility (not core). New `src/utils/` directory follows convention for shared non-component helpers.

**`toolIcons` — export from `Toolbar.vue`**: Toolbar is the authoritative source. Named export `toolIcons` imported by `MobileHud`.

**`mobileDrawerSnap` type: `'closed' | 'half' | 'full'`**: The numeric `0` value was a legacy relic. All code in `MobileDrawer` and `MobileRibbon` already treated `0` as `'closed'`. Migrate to string union, remove the ternary workarounds.

**Clipboard in editor store**: Module-level mutable state in `Toolbar.vue` is not accessible to other components. Store field `clipboardHtml: string` with actions `mobileCopy`, `mobileCut`, `mobilePaste` in editor store.

**reka-ui Popover for peers list, DropdownMenu for app menu**: Project convention. `onClickOutside` workaround replaced by reka-ui's built-in outside-click handling.

**`useBreakpoints` in `EditorView`**: Consistent with `@vueuse/core` usage throughout the codebase.

## Risks / Trade-offs

[`mobileDrawerSnap` type change] → All assignment sites set string values — no runtime risk, verified by TypeScript compiler.

[Moving clipboard to store] → Slightly more verbose, but correct — the store is the right owner of shared mutable state.
