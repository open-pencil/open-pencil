## Why

The editor has a fixed three-column desktop layout (layers | canvas | properties) using reka-ui Splitter. On mobile/tablet viewports (<768px), the side panels consume all usable space, making the canvas unusable. There's no responsive behavior, no breakpoint detection, and no mobile-optimized UI. The canvas already handles touch pinch-zoom, so the rendering layer is ready — the chrome needs to adapt.

## What Changes

- Detect mobile viewport via `useMediaQuery('(max-width: 767px)')` from `@vueuse/core` in EditorView
- On mobile: hide desktop side panels, show canvas fullscreen with HUD overlay
- Add a custom bottom drawer (CSS translateY + transition) that slides up to reveal panel content. Snap points: closed, half (~3/7 viewport), full (viewport minus HUD area)
- Fixed ribbon tab bar at viewport bottom — always visible and thumb-reachable
- Ribbon tabs: Layers and Design as separate buttons (with label when active), Code and AI as icon-only buttons on the right
- Extract layer tree into `LayerTree.vue` for reuse in both desktop LayersPanel and mobile drawer
- Render DesignPanel, CodePanel, ChatPanel directly in mobile drawer via `v-show` (preserve ChatPanel state)
- PagesPanel in compact drawer header; AppMenu hidden on mobile
- MobileHud: undo/redo buttons, active tool indicator, online badge with peers dropdown, action toast, Share button, burger menu (New/Open/Save/Export/Zoom to fit)
- Mobile toolbar with 3 categories (Tools/Edit/Arrange), arrow navigation, animated width transitions
- Touch-to-mouse event synthesis for non-HAND tools in canvas input
- Rulers hidden on mobile
- Internal clipboard buffer for copy/paste (mobile browser clipboard API limitations)
- Fix `showUI` initialization to `true` (was gated by matchMedia)
- ⌘J shortcut bridges mobile/desktop: toggles `activeRibbonTab` on mobile
- Mobile state (`activeRibbonTab`, `panelMode`, `mobileDrawerSnap`, `actionToast`) in editor store
- Z-index layering: canvas < toolbar (z-10) < ribbon (z-40) < drawer (z-30) < popovers (z-50)
- Desktop layout completely unchanged

## Capabilities

### New Capabilities
- `mobile-layout`: Responsive mobile/tablet layout with custom bottom drawer, fixed ribbon tabs, MobileHud overlay, touch tool support, and adaptive panel switching

### Modified Capabilities
- `editor-ui`: EditorView gains responsive breakpoint detection and conditional rendering of desktop vs mobile chrome

## Impact

- `src/views/EditorView.vue` — conditional desktop/mobile layout
- `src/components/MobileDrawer.vue` — new: custom drawer with translateY transitions and drag gestures
- `src/components/MobileRibbon.vue` — new: fixed bottom tab bar
- `src/components/MobileHud.vue` — new: overlay with undo/redo, tool indicator, online badge, toast, burger menu
- `src/components/LayerTree.vue` — new: extracted from LayersPanel
- `src/components/LayersPanel.vue` — refactored to use LayerTree
- `src/components/Toolbar.vue` — 3 mobile categories with animated width, select-none, touch-friendly
- `src/stores/editor.ts` — new state: `activeRibbonTab`, `panelMode`, `mobileDrawerSnap`, `actionToast`; fix `showUI` init
- `src/composables/use-keyboard.ts` — ⌘J mobile bridge
- `src/composables/use-canvas-input.ts` — touch→mouse event synthesis for non-HAND tools
- `src/composables/use-canvas.ts` — rulers hidden on mobile
