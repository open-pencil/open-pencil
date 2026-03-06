## Why

PR #27 (mobile layout) received review feedback from @dannote flagging 12 issues: code duplication, violation of project conventions (constants, reka-ui components, store types), and a dev-mode PWA bug. These must be fixed before the branch can be merged.

## What Changes

- Extract `toolIcons` map from `MobileHud.vue` — export it from `Toolbar.vue` and import in `MobileHud.vue`
- Extract `colorToCSS` to `packages/core/src/color.ts` (compose with `colorToRgba255`)
- Extract `initials` to a shared util (`src/utils/text.ts`)
- Remove duplicate `colorToCSS` / `initials` from `MobileHud.vue` and `CollabPanel.vue` — import from shared locations
- Replace hand-rolled peers dropdown with `PopoverRoot`/`PopoverContent` from reka-ui
- Replace hand-rolled menu dropdown in `MobileHud.vue` with `DropdownMenuRoot`/`DropdownMenuContent` from reka-ui
- Tighten `mobileDrawerSnap` type in `editor.ts` from `number | string | null` to `'closed' | 'half' | 'full'`; update all usages
- Move magic numbers `RIBBON_H`, `HALF_FRAC`, `HUD_TOP` from `MobileDrawer.vue` to `src/constants.ts`
- Move `SWIPE_THRESHOLD`, `SWIPE_MAX_DURATION` from `MobileRibbon.vue` to `src/constants.ts`
- Move `ACTION_TOAST_DURATION` from `Toolbar.vue` to `src/constants.ts`
- Move `internalClipboard` module-level mutable state from `Toolbar.vue` into the editor store
- Replace `animate-` custom class with `tw-animate-css` in `MobileHud.vue` (line 264)
- Disable PWA service worker in dev: `devOptions: { enabled: false }` in `vite.config.ts`
- Replace `useMediaQuery('(max-width: 767px)')` in `EditorView.vue` with `useBreakpoints`

## Capabilities

### New Capabilities

- `shared-color-utils`: `colorToCSS` utility exported from `@open-pencil/core` color module
- `shared-text-utils`: `initials` string utility in `src/utils/text.ts`

### Modified Capabilities

_(none — no spec-level behavior changes, purely code quality / convention fixes)_

## Impact

- `packages/core/src/color.ts` — new export `colorToCSS`
- `src/utils/text.ts` — new file with `initials`
- `src/constants.ts` — new constants: `RIBBON_H`, `HALF_FRAC`, `HUD_TOP`, `SWIPE_THRESHOLD`, `SWIPE_MAX_DURATION`, `ACTION_TOAST_DURATION`
- `src/stores/editor.ts` — type of `mobileDrawerSnap` narrowed; new `clipboardData` field
- `src/components/Toolbar.vue` — exports `toolIcons`; removes `internalClipboard`; uses constant
- `src/components/MobileHud.vue` — imports shared utils/icons; uses reka-ui Popover + DropdownMenu; uses `tw-animate-css`
- `src/components/CollabPanel.vue` — imports `colorToCSS` from core, `initials` from shared util
- `src/components/MobileDrawer.vue` — imports constants
- `src/components/MobileRibbon.vue` — imports constants
- `src/views/EditorView.vue` — uses `useBreakpoints` instead of raw `useMediaQuery`
- `vite.config.ts` — SW disabled in dev
