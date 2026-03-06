## 1. Shared utilities

- [x] 1.1 Add `colorToCSS(c: Color): string` to `packages/core/src/color.ts` — compose with existing `colorToRgba255`: `const {r,g,b} = colorToRgba255(c); return \`rgb(${r}, ${g}, ${b})\``; add to named exports in `packages/core/src/index.ts`
- [x] 1.2 Create `src/utils/text.ts` — export `initials(name: string): string` that splits on spaces, takes first letter of each word, uppercases, slices to 2 chars, falls back to `"?"`
- [x] 1.3 Create `src/utils/tools.ts` — move `toolIcons: Record<Tool, Component>` map here (import `Tool` type from `@/stores/editor`, import icon components); export named `toolIcons`

## 2. Constants

- [x] 2.1 Add to `src/constants.ts`: `RIBBON_H = 44`, `HALF_FRAC = 3 / 7`, `HUD_TOP = 12 + 32 + 6 + 32 + 12` (from `MobileDrawer.vue`); `SWIPE_THRESHOLD = 30`, `SWIPE_MAX_DURATION = 500` (from `MobileRibbon.vue`); `ACTION_TOAST_DURATION = 800` (from `Toolbar.vue`)

## 3. Store changes

- [x] 3.1 In `editor.ts` change `mobileDrawerSnap` type to `'closed' | 'half' | 'full'` and default to `'closed'`. Update all assignment sites: `src/views/EditorView.vue:72` (`=== 0` check → remove, only keep `=== 'closed'`; line 73 stays), `src/components/MobileRibbon.vue` (lines 23,25,36,39,61,65,68 — replace `!== 0` → `!== 'closed'`, `= 0` → `= 'closed'`), `src/components/MobileDrawer.vue:23` (setter: `v === 'closed' ? 0 : v` → just `v`), `src/composables/use-keyboard.ts:95` (remove `=== 0 ||`, keep `=== 'closed'` check)
- [x] 3.2 In `editor.ts` add `clipboardHtml: ''` to state; add store actions: `mobileCopy()` — creates `new DataTransfer()`, calls `writeCopyData(transfer)`, sets `state.clipboardHtml = transfer.getData('text/html')`; `mobileCut()` — calls `mobileCopy()` then `deleteSelected()`; `mobilePaste()` — calls `pasteFromHTML(state.clipboardHtml)` when `state.clipboardHtml` is non-empty. (`writeCopyData` and `pasteFromHTML` already exist in the store.)

## 4. Toolbar.vue

- [x] 4.1 Remove `toolIcons` definition from `Toolbar.vue`; import from `@/utils/tools`
- [x] 4.2 Remove `internalClipboard` module-level variable; replace local `mobileCopy`/`mobileCut`/`mobilePaste` functions with `store.mobileCopy()`, `store.mobileCut()`, `store.mobilePaste()` calls
- [x] 4.3 Replace `const ACTION_TOAST_DURATION = 800` (removed from store-level logic); ensure `ACTION_TOAST_DURATION` is imported from `@/constants` wherever the literal `800` was used

## 5. MobileHud.vue

- [x] 5.1 Remove the local `toolIcons` map and all icon component imports used only for it; import `toolIcons` from `@/utils/tools`
- [x] 5.2 Import `colorToCSS` from `@open-pencil/core`; remove local `colorToCSS` function
- [x] 5.3 Import `initials` from `@/utils/text`; remove local `initials` function
- [x] 5.4 Replace hand-rolled peers `<div v-if="peersOpen">` with reka-ui: wrap Online badge button in `<PopoverTrigger as-child>`, add `<PopoverPortal><PopoverContent :modal="false">` with the peers list inside; remove `peersOpen` ref
- [x] 5.5 Replace hand-rolled app menu `<div v-if="menuOpen">` with reka-ui: wrap menu button in `<DropdownMenuTrigger as-child>`, add `<DropdownMenuPortal><DropdownMenuContent>` with `<DropdownMenuItem>` per action; remove `menuRef` ref, `menuOpen` ref, and `onClickOutside` import/call
- [x] 5.6 Replace `<style scoped>` `toast-fade-*` CSS block + `<Transition name="toast-fade">` with `<Transition enter-active-class="animate-fade-in" leave-active-class="animate-fade-out">` (tw-animate-css is already imported in `app.css`)

## 6. CollabPanel.vue

- [x] 6.1 Import `colorToCSS` from `@open-pencil/core`; remove local definition
- [x] 6.2 Import `initials` from `@/utils/text`; remove local definition

## 7. MobileDrawer.vue

- [x] 7.1 Import `RIBBON_H`, `HALF_FRAC`, `HUD_TOP` from `@/constants`; remove local `const` declarations
- [x] 7.2 Update computed `snap` setter: remove `v === 'closed' ? 0 : v` — set `store.state.mobileDrawerSnap` directly to `v` (already a `Snap` value after 3.1)

## 8. MobileRibbon.vue

- [x] 8.1 Import `SWIPE_THRESHOLD`, `SWIPE_MAX_DURATION` from `@/constants`; remove local `const` declarations
- [x] 8.2 All `mobileDrawerSnap` comparison/assignment sites are already covered by task 3.1 — verify no remaining `0` literals remain

## 9. EditorView.vue

- [x] 9.1 Replace `useMediaQuery('(max-width: 767px)')` with `const breakpoints = useBreakpoints({ mobile: 768 })` and `const isMobile = breakpoints.smaller('mobile')` — uses `< 768` matching the original `<= 767px` behavior

## 10. vite.config.ts

- [x] 10.1 Change `devOptions: { enabled: true }` to `devOptions: { enabled: false }` to stop the SW from intercepting dev requests and causing stale cache bugs

## 11. Verification

- [x] 11.1 Run `bun run check` — no type errors or lint warnings
- [x] 11.2 Run `bun run test:unit` — no regressions
- [x] 11.3 Add entry to `CHANGELOG.md` Unreleased section (internal refactor: mobile PR cleanup)
