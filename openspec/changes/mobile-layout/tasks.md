## 1. Store & State

- [x] 1.1 Add mobile state to editor store (`src/stores/editor.ts`): `activeRibbonTab: 'panels' | 'code' | 'ai' | null` (default `null`), `panelMode: 'layers' | 'design'` (default `'design'`), `mobileDrawerSnap: 0 | 'half' | 'full' | 'closed'` (default `0`), `actionToast: string | null` (default `null`)
- [x] 1.2 Fix `showUI` initialization: change from `matchMedia(...)` to `true`

## 2. Extract LayerTree Component

- [x] 2.1 Create `src/components/LayerTree.vue` — extract tree logic from LayersPanel: reka-ui TreeRoot/TreeItem, drag reorder, expand/collapse, context menu, visibility icon. Import order: reka-ui → vue → @vueuse → icons → @/ → relative
- [x] 2.2 Refactor `src/components/LayersPanel.vue` to use `<LayerTree />`

## 3. MobileRibbon Component

- [x] 3.1 Create `src/components/MobileRibbon.vue` — fixed bar at viewport bottom (`fixed bottom-0 z-40`), outside the drawer. Layers/Design as separate buttons (icon + label when active), Code/AI as icon-only buttons on right. 44px touch targets. `env(safe-area-inset-bottom)` padding. All tabs have `select-none outline-none transition-colors`. No `hover:` states — mobile only uses state-based styles
- [x] 3.2 Swipe gestures on ribbon: swipe up opens drawer (half/full), swipe down closes. `SWIPE_THRESHOLD = 30`, `SWIPE_MAX_DURATION = 500`
- [x] 3.3 Tab tap toggles: tap active tab while drawer open → close drawer + reset `activeRibbonTab` to null

## 4. MobileDrawer Component

- [x] 4.1 Create `src/components/MobileDrawer.vue` — custom drawer using CSS `translateY` + `transition` (NOT vaul-vue). Snap states: closed, half (3/7 viewport), full (viewport - 44px ribbon - 94px HUD). `renderSnap` ref with `nextTick()` + `requestAnimationFrame()` for smooth open animation
- [x] 4.2 Drag gestures on entire drawer body (not just handle). 50px threshold. Swipe down: full→half→closed. Swipe up: closed→half→full. Drag handle with `select-none`
- [x] 4.3 Drawer header: compact PagesPanel (horizontal scrollable) with border-b
- [x] 4.4 Panel content via `v-show`: LayerTree, DesignPanel, CodePanel, ChatPanel. `@touchstart.stop @touchmove.stop` on content area to prevent canvas interaction

## 5. MobileHud Component

- [x] 5.1 Create `src/components/MobileHud.vue` — absolute overlay with `pointer-events-none` root, `pointer-events-auto` on interactive groups. `@touchstart.stop` on root
- [x] 5.2 Top-left: Undo/redo buttons (`size-8 rounded-full border border-border shadow-md select-none`) + active tool indicator (`border-accent/30`, animated icon change via `Transition mode="out-in"`)
- [x] 5.3 Top-center: Online badge with peers dropdown (simple div toggle, not reka-ui Popover) + action toast (`toast-fade` transition, 800ms duration from `ACTION_TOAST_DURATION`)
- [x] 5.4 Top-right: Share button + burger menu (`onClickOutside` for dismiss). Menu items: New, Open, Save, Export, Zoom to fit. Each with Lucide icon. `border-none bg-transparent outline-none select-none`

## 6. EditorView Responsive Layout

- [x] 6.1 Add `isMobile = useMediaQuery('(max-width: 767px)')` in EditorView. Conditional: desktop SplitterGroup vs mobile layout
- [x] 6.2 Mobile layout: EditorCanvas + MobileHud (collab props forwarded) + Toolbar + MobileRibbon + MobileDrawer
- [x] 6.3 Wire `@tab-change` on MobileRibbon: auto-open drawer to half if collapsed

## 7. Keyboard Shortcut: ⌘J on mobile

- [x] 7.1 In `use-keyboard.ts`, detect `isMobile`. On ⌘J: mobile toggles `activeRibbonTab` between current and `'ai'` (opens drawer if collapsed); desktop unchanged

## 8. Toolbar Mobile Adaptation

- [x] 8.1 3 categories: Category 0 (drawing tools), Category 1 (Copy/Paste/Cut/Duplicate/Delete), Category 2 (Front/Back/Group/Ungroup/Lock). Arrow navigation buttons
- [x] 8.2 Animated container width: active category `relative` (sets width), others `absolute left-2 top-1/2 -translate-y-1/2` with opacity transition. Width via `scrollWidth` measurement + `transition: width 250ms ease`
- [x] 8.3 Internal clipboard: `mobileCopy()`, `mobileCut()`, `mobilePaste()` using in-memory buffer
- [x] 8.4 Action toast: `onActionTap()` sets `store.state.actionToast` for `ACTION_TOAST_DURATION` (800ms)
- [x] 8.5 All buttons: `select-none border-none`, `rounded-[8px]` container, `rounded-[6px]` buttons, `h-11` container with `size-8` buttons

## 9. Touch & Canvas

- [x] 9.1 `use-canvas-input.ts`: `syntheticMouse()` helper creates MouseEvent from Touch. Single finger on non-HAND tool → delegate to mouse handlers. Two-finger → pinch-zoom (existing)
- [x] 9.2 `use-canvas.ts`: hide rulers on mobile via `!isMobile` check

## 10. Code Style Alignment

- [x] 10.1 Import ordering: reka-ui → vue → icons → @vueuse → @/ → relative → type imports
- [x] 10.2 No semicolons (codebase convention)
- [x] 10.3 `select-none` on all tappable elements
- [x] 10.4 `outline-none` on focusable elements (MobileRibbon tabs, menu items)
- [x] 10.5 Magic numbers extracted: `ACTION_TOAST_DURATION`, `SWIPE_MAX_DURATION`, `SWIPE_THRESHOLD`, `RIBBON_H`, `HALF_FRAC`, `HUD_TOP`
- [x] 10.6 No `hover:` on mobile-only elements — only `active:` for touch feedback
- [x] 10.7 `border-none bg-transparent` on menu/action buttons

## 11. Verification

- [x] 11.1 Desktop layout unchanged at ≥768px
- [x] 11.2 `bun run check` passes (0 errors)
