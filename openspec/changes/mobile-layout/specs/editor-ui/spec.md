## MODIFIED Requirements

### Requirement: Bottom toolbar
The toolbar SHALL be positioned at the bottom of the screen with tool selection: Select (V), Frame (F), Section (S, in Frame flyout), Rectangle (R), Ellipse (O), Line (L), Polygon (flyout), Star (flyout), Text (T), Hand (H), Pen (P). On mobile viewports (<768px), the toolbar SHALL split into 3 categories navigated by arrow buttons: Category 0 (drawing tools with flyouts), Category 1 (Copy/Paste/Cut/Duplicate/Delete), Category 2 (Front/Back/Group/Ungroup/Lock). Buttons SHALL be `size-8` inside an `h-11` container with `rounded-[8px]` box and `rounded-[6px]` buttons. The toolbar SHALL be positioned above the MobileRibbon bar. Container width SHALL animate (250ms ease) when switching categories. All mobile buttons SHALL have `select-none border-none`. Edit/arrange actions SHALL trigger action toasts via `store.state.actionToast`.

### Requirement: Resizable panels
The left (layers) and right (properties) panels SHALL be resizable via reka-ui Splitter components on desktop viewports (≥768px). On mobile viewports, panels SHALL render inside the bottom drawer instead of the SplitterGroup.
