## ADDED Requirements

### Requirement: Mobile viewport detection
The editor SHALL detect mobile viewports using a `(max-width: 767px)` media query via `useMediaQuery` from `@vueuse/core` in EditorView. The detection SHALL be reactive — rotating a device or resizing a browser window SHALL switch layouts without page reload.

### Requirement: Mobile canvas fullscreen
On mobile viewports, the EditorCanvas SHALL fill the entire viewport. The desktop SplitterGroup with LayersPanel and PropertiesPanel SHALL NOT render. Rulers SHALL be hidden on mobile.

### Requirement: Custom bottom drawer
The editor SHALL display a custom bottom drawer on mobile viewports containing panel content. The drawer SHALL use CSS `translateY` transitions (not a portal-based library). Three snap states: closed (fully hidden), half (~3/7 viewport height), full (viewport minus ribbon and HUD area). The drawer SHALL support drag gestures on the entire drawer body with a 50px threshold. The active snap SHALL be stored in `store.state.mobileDrawerSnap`. Swipe down from full goes to half, then to closed. Swipe up from closed goes to half, then to full.

#### Scenario: Smooth open animation
- **WHEN** the drawer transitions from closed to half
- **THEN** it animates via CSS transition (not instant jump), using requestAnimationFrame to ensure initial position renders before transition

#### Scenario: Drag to dismiss
- **WHEN** user swipes down >50px from half snap
- **THEN** drawer transitions to closed and `activeRibbonTab` resets to null

### Requirement: Fixed bottom ribbon tab bar
The editor SHALL render a MobileRibbon as a fixed bar at the viewport bottom (`fixed bottom-0 z-40`), outside the drawer. Tabs: Layers and Design as separate buttons (icon + label when active), Code and AI as icon-only buttons on the right. Visible at all times. Touch targets ≥44px. Safe area inset padding via `env(safe-area-inset-bottom)`.

#### Scenario: Ribbon swipe gestures
- **WHEN** user swipes up on the ribbon while drawer is closed
- **THEN** drawer opens to half snap

#### Scenario: Tab tap auto-opens drawer
- **WHEN** user taps a tab while drawer is collapsed
- **THEN** drawer animates to half snap

#### Scenario: Tab tap toggles drawer
- **WHEN** user taps the already-active tab while drawer is open
- **THEN** drawer closes and tab highlight resets to null

### Requirement: MobileHud overlay
The editor SHALL render a MobileHud component as an absolute overlay on the canvas area with:
- Top-left: Undo/redo buttons + active tool indicator (animated icon change)
- Top-center: Online badge (when connected, with peers dropdown) + action toast (800ms fade)
- Top-right: Share button + burger menu (New, Open, Save, Export, Zoom to fit)

The root SHALL have `pointer-events-none` with `pointer-events-auto` on interactive groups. `@touchstart.stop` SHALL prevent touch events from leaking to canvas.

#### Scenario: Action toast display
- **WHEN** user taps an edit/arrange action in the toolbar
- **THEN** a toast with the action name appears in the HUD center for 800ms

#### Scenario: Burger menu file operations
- **WHEN** user taps the burger menu button
- **THEN** a dropdown shows New, Open, Save, Export, Zoom to fit options

### Requirement: Mobile toolbar categories
On mobile, the toolbar SHALL split into 3 categories: drawing tools (Category 0), edit actions (Category 1: Copy/Paste/Cut/Duplicate/Delete), arrange actions (Category 2: Front/Back/Group/Ungroup/Lock). Arrow buttons navigate between categories. The container width SHALL animate smoothly (250ms ease) when switching categories. Buttons SHALL be `size-8` inside an `h-11` container. All buttons SHALL have `select-none` and `border-none`.

#### Scenario: Category switch animation
- **WHEN** user taps the right arrow from Category 0
- **THEN** the container width animates to Category 1's width and icons crossfade via opacity transition

#### Scenario: Edit action with toast
- **WHEN** user taps Delete in Category 1
- **THEN** the selected node is deleted and "Delete" toast shows in MobileHud

### Requirement: Touch-to-mouse event synthesis
`use-canvas-input.ts` SHALL synthesize MouseEvents from TouchEvents for non-HAND tools. Single-finger touch on SELECT/FRAME/RECTANGLE/etc. SHALL trigger `onMouseDown`/`onMouseMove`/`onMouseUp` with coordinates from the touch. Two-finger pinch-zoom SHALL continue to work. HAND tool SHALL use direct pan handling (no mouse synthesis).

### Requirement: Internal clipboard for mobile
Copy/paste toolbar buttons SHALL use an in-memory clipboard buffer instead of system clipboard API. Copy stores HTML via `store.writeCopyData(new DataTransfer())`. Paste reads from the buffer via `store.pasteFromHTML()`.

### Requirement: showUI initialization
The `showUI` store flag SHALL be initialized to `true` (not gated by matchMedia). On mobile with `showUI=true`: canvas + HUD + toolbar + ribbon + drawer. On mobile with `showUI=false`: only canvas.

### Requirement: ⌘J shortcut on mobile
On mobile, ⌘J SHALL toggle `activeRibbonTab` between current tab and `'ai'`, opening the drawer if collapsed. On desktop, existing behavior unchanged.

### Requirement: Extracted LayerTree component
The layer tree (tree nodes, drag reorder, expand/collapse, context menu, visibility toggle) SHALL be extracted from LayersPanel into `LayerTree.vue`. LayersPanel uses LayerTree internally. MobileDrawer uses LayerTree directly.

### Requirement: Panel content preservation
All panels in the mobile drawer SHALL use `v-show` instead of `v-if` to preserve component state during tab switches.

### Requirement: Desktop layout unchanged
On desktop viewports (≥768px), the existing SplitterGroup layout SHALL render unchanged. Mobile components SHALL NOT render.

### Requirement: Full drawer height limit
When the drawer is at full snap, its height SHALL stop below the active tool indicator in the MobileHud, with the same spacing as the HUD has from the viewport top. Full height = viewport - ribbon height (44px) - HUD top area (94px).
