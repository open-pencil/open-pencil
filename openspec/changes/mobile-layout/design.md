## Context

OpenPencil's EditorView uses a horizontal SplitterGroup with three panels: LayersPanel (18%), EditorCanvas (64%), PropertiesPanel (18%). This works on desktop but fails on small screens. The canvas already supports touch pinch-zoom and multi-touch gestures via `use-canvas-input.ts`.

## Goals / Non-Goals

**Goals:**
- Usable editor on viewports ≥320px wide through 768px
- Canvas gets maximum screen real estate on mobile
- All panel content accessible via bottom drawer
- Touch-friendly interactions (≥44px targets, swipe gestures)
- Zero impact on desktop layout

**Non-Goals:**
- Tablet landscape split view
- PWA / offline mobile support
- Native mobile app

## Decisions

### 1. Custom drawer instead of vaul-vue

Initially planned vaul-vue, but replaced with a custom implementation using CSS `translateY` + `transition` + `requestAnimationFrame`. Reasons:
- vaul-vue portals to `<body>`, creating z-index conflicts with CanvasKit WebGL surface
- Custom drawer gives precise control over snap points and drag behavior
- Simpler DOM structure — drawer stays in normal flow, no portal

Implementation: `MobileDrawer.vue` uses `renderSnap` ref with `nextTick()` + `requestAnimationFrame()` pattern for smooth open animation (force browser to render initial position before transitioning).

### 2. Snap points: closed / half / full

- **Closed**: `translateY(100%)` — fully hidden, only ribbon visible
- **Half**: 3/7 of viewport height — shows enough panel content for quick edits
- **Full**: viewport minus ribbon (44px) minus HUD top area (94px) — stops below the active tool indicator

Drag gestures on the entire drawer body (not just handle) — swipe down from full → half → closed, swipe up from closed → half → full. Threshold: 50px displacement.

### 3. MobileHud overlay

New `MobileHud.vue` component rendered as absolute overlay on the canvas area:
- **Top-left**: Undo/redo buttons (rounded circles, shadow), active tool indicator below
- **Top-center**: Online badge (when connected) + action toast (fade animation)
- **Top-right**: Share button + burger menu (New, Open, Save, Export, Zoom to fit)
- Root div has `pointer-events-none`, child groups have `pointer-events-auto`
- `@touchstart.stop` prevents touch events leaking to canvas

### 4. Ribbon outside the drawer

MobileRibbon is `fixed bottom-0 z-40` — always visible regardless of drawer state. Drawer content appears above the ribbon. The ribbon has:
- Layers and Design as separate buttons (icon + label when active)
- Code and AI as icon-only buttons on the right
- Swipe up/down on ribbon triggers drawer snap changes
- Tab tap when drawer closed auto-opens to half snap

### 5. Toolbar 3-category system (mobile only)

Desktop toolbar unchanged. Mobile toolbar splits into 3 categories:
- **Category 0**: Drawing tools (all TOOLS from store, with flyout dropdowns)
- **Category 1**: Edit actions (Copy, Paste, Cut, Duplicate, Delete)
- **Category 2**: Arrange actions (Front, Back, Group, Ungroup, Lock)

Arrow buttons navigate between categories. Container width animates smoothly: all categories stacked in same space, active one `relative` (sets width), others `absolute` with opacity transition. Width animation via inline `transition: width 250ms ease`.

Edit/Arrange actions show toast via `store.state.actionToast` (displayed in MobileHud).

### 6. Touch-to-mouse synthesis

`use-canvas-input.ts` handles touch events on canvas:
- Single finger on HAND tool → direct pan (existing pinch-zoom behavior)
- Single finger on any other tool → `syntheticMouse()` creates MouseEvent from Touch, delegates to `onMouseDown`/`onMouseMove`/`onMouseUp`
- Two-finger pinch → pinch-zoom (existing)
- `@touchstart.stop` on HUD and toolbar prevents leaking to canvas

### 7. Internal clipboard for mobile

Mobile browsers restrict clipboard API access outside user gesture chains. Copy/paste buttons in toolbar use an in-memory `internalClipboard` variable:
- Copy: `store.writeCopyData(new DataTransfer())` → store HTML in variable
- Paste: `store.pasteFromHTML(internalClipboard)`
- Cut: copy + `store.deleteSelected()`

### 8. Rulers hidden on mobile

`use-canvas.ts` skips ruler rendering when `isMobile` is true. Rulers take valuable screen space and are impractical on touch devices.

### 9. Z-index layering

| Element | Z-index | Position |
|---------|---------|----------|
| Canvas | base | Normal flow |
| Toolbar | z-10 | Absolute, above ribbon |
| MobileDrawer | z-30 | Fixed, above canvas |
| MobileRibbon | z-40 | Fixed bottom |
| Popovers/dropdowns | z-50 | Portal |
| HUD | z-10 | Absolute overlay on canvas |

### 10. State in editor store

```
activeRibbonTab: 'panels' | 'code' | 'ai' | null  (null = no highlight when drawer closed)
panelMode: 'layers' | 'design'
mobileDrawerSnap: 0 | 'half' | 'full' | 'closed'
actionToast: string | null
```

## Risks / Trade-offs

**[Trade-off] Custom drawer vs library** — More code to maintain, but full control over behavior and no portal issues.

**[Trade-off] Internal clipboard** — Copy/paste only works within the same session, not across apps. Acceptable limitation for mobile.

**[Trade-off] AppMenu hidden on mobile** — File operations accessible via burger menu in HUD. Not all desktop menu items available on mobile.

**[Risk] Virtual keyboard** — May push viewport when editing text in drawer. Start with default behavior, iterate if needed.
