## Requirements

### Requirement: Assets panel displays all components grouped by page
The Assets panel SHALL list all COMPONENT and COMPONENT_SET nodes in the document, grouped under collapsible page sections (expanded by default). Each page section shows the page name as header with a chevron toggle. INSTANCE nodes SHALL NOT appear in the listing. Empty pages (with no components) SHALL be omitted. Components nested inside frames/groups/sections SHALL be found via recursive traversal.

#### Scenario: Document with components on two pages
- **WHEN** the document has components "Button" and "Card" on Page 1, and "Header" on Page 2
- **THEN** the Assets panel shows two collapsible sections: "Page 1" with Button and Card, "Page 2" with Header

#### Scenario: Document with no components
- **WHEN** the document has no COMPONENT or COMPONENT_SET nodes
- **THEN** the Assets panel shows an empty state: centered icon, "No components" title, and hint "Select a frame and press ⌥⌘K to create a component"

#### Scenario: Page with no components is hidden
- **WHEN** Page 3 has shapes but no COMPONENT nodes
- **THEN** Page 3 does not appear in the Assets panel listing

#### Scenario: Component nested inside a frame
- **WHEN** a COMPONENT "Icon" exists inside a frame "Icons Container" on Page 1
- **THEN** "Icon" appears in the Page 1 section of the Assets panel

### Requirement: COMPONENT_SET variant expansion
COMPONENT_SET items in the Assets panel SHALL be expandable (reka-ui Collapsible) to reveal their child COMPONENT nodes (variants). Each variant SHALL be individually selectable, draggable, and insertable. The set itself is also insertable (inserts the first variant by default).

#### Scenario: Expand component set to see variants
- **WHEN** a COMPONENT_SET "Button" has children "Button/Primary" and "Button/Secondary"
- **THEN** clicking the expand chevron reveals "Button/Primary" and "Button/Secondary" as indented items

#### Scenario: Insert specific variant
- **WHEN** user drags "Button/Secondary" from the expanded set onto the canvas
- **THEN** an INSTANCE of "Button/Secondary" (not "Button/Primary") is created

#### Scenario: Insert from collapsed set
- **WHEN** user drags the collapsed "Button" COMPONENT_SET onto the canvas
- **THEN** an INSTANCE of the first variant child is created

### Requirement: Component search by name
The Assets panel SHALL provide a search input that filters components by name using case-insensitive substring matching. The search applies across all pages. When the search query is active, only matching components are shown (page grouping preserved, empty groups hidden). COMPONENT_SET children (variants) SHALL also be searched. Clearing the search restores the full list.

#### Scenario: Search finds matching components
- **WHEN** user types "btn" in the search input
- **THEN** only components whose names contain "btn" (case-insensitive) are displayed

#### Scenario: Search finds variant inside set
- **WHEN** user types "primary" and a COMPONENT_SET has a variant "Button/Primary"
- **THEN** the COMPONENT_SET expands to show "Button/Primary", even if the set name doesn't match

#### Scenario: Search with no results
- **WHEN** user types "zzzzz" in the search input
- **THEN** the panel shows "No results for 'zzzzz'" message

#### Scenario: Clear search restores full list
- **WHEN** user clears the search input
- **THEN** all components are shown grouped by page

### Requirement: Component thumbnail preview
Each component item SHALL display a 48×48 pixel thumbnail preview rendered via CanvasKit offscreen surface. Thumbnails SHALL be generated as blob URLs via `renderNodesToImage()` at scale 1, PNG format. Thumbnails SHALL update when the component's visual appearance changes (tracked via sceneVersion with 500ms debounce). Old blob URLs SHALL be revoked via `URL.revokeObjectURL()` before replacement. Items without a ready thumbnail show a placeholder icon.

#### Scenario: Component thumbnail renders
- **WHEN** a COMPONENT "Button" with a blue fill and text exists
- **THEN** the Assets panel shows a 48×48 thumbnail preview of the button

#### Scenario: Thumbnail updates after component edit
- **WHEN** user changes a component's fill color from blue to red
- **THEN** the thumbnail updates within 500ms after the edit completes

#### Scenario: Thumbnail placeholder before render
- **WHEN** the Assets panel first opens and thumbnails haven't rendered yet
- **THEN** each item shows a gray placeholder icon instead of a thumbnail

### Requirement: Component instance count
Each component item SHALL display the number of INSTANCE nodes referencing it, shown as a dim badge (e.g. "3×"). The count is read from `graph.instanceIndex.get(componentId)?.size ?? 0`. Count of 0 shows no badge.

#### Scenario: Component with instances
- **WHEN** a COMPONENT "Card" has 5 instances in the document
- **THEN** the Assets panel shows "5×" badge next to "Card"

#### Scenario: Component with no instances
- **WHEN** a COMPONENT "Header" has no instances
- **THEN** no instance count badge is shown

### Requirement: Component description tooltip
Each component item SHALL show its `description` field (from SceneNode) as a native title tooltip on hover. If description is empty, the title falls back to the component name.

#### Scenario: Component with description
- **WHEN** a COMPONENT has description "Primary action button for forms"
- **THEN** hovering shows the description as a browser tooltip

### Requirement: Drag component from Assets panel to canvas
The user SHALL be able to drag a component item from the Assets panel onto the canvas to create an INSTANCE at the drop position. The drag uses HTML5 Drag and Drop API with MIME type `application/x-openpencil-component`. The drop handler checks for this MIME type BEFORE checking for image files. Drop coordinates are converted from screen space to canvas space via `screenToCanvas()`. The instance is created on the current page regardless of which page the component lives on.

#### Scenario: Drag component to canvas creates instance
- **WHEN** user drags "Button" from Assets panel and drops at (300, 200) on canvas
- **THEN** an INSTANCE of "Button" is created at the corresponding canvas coordinates on the current page

#### Scenario: Drag cross-page component
- **WHEN** user drags a component from Page 2 while viewing Page 1
- **THEN** the INSTANCE is created on Page 1 (current page), not Page 2

#### Scenario: Drop outside canvas has no effect
- **WHEN** user drags a component and releases outside the canvas
- **THEN** no instance is created

### Requirement: Double-click inserts instance at viewport center
Double-clicking a component item SHALL create an INSTANCE at the center of the current viewport and select it.

#### Scenario: Double-click inserts at center
- **WHEN** user double-clicks "Card" component in Assets panel
- **THEN** an INSTANCE of "Card" appears at viewport center and is selected

### Requirement: Asset item context menu
Right-clicking a component item SHALL show a context menu (reka-ui ContextMenu) with two actions: "Insert instance" (creates instance at viewport center) and "Go to component" (navigates to component on canvas).

#### Scenario: Context menu insert
- **WHEN** user right-clicks a component and selects "Insert instance"
- **THEN** an INSTANCE is created at viewport center

#### Scenario: Context menu navigate
- **WHEN** user right-clicks a component and selects "Go to component"
- **THEN** the editor navigates to the component's page, centers viewport on it, and selects it

### Requirement: Component list reactivity
The component list SHALL update automatically when components are created, deleted, renamed, or reparented. The list is recomputed from SceneGraph on each `sceneVersion` change.

#### Scenario: New component appears in list
- **WHEN** user creates a new component via ⌥⌘K
- **THEN** the Assets panel immediately shows the new component

#### Scenario: Deleted component removed from list
- **WHEN** user deletes a component
- **THEN** the component disappears from the Assets panel

#### Scenario: Renamed component updates in list
- **WHEN** user renames a component from "Button" to "PrimaryButton"
- **THEN** the Assets panel shows the updated name


### Requirement: Assets panel displays all components grouped by page
The Assets panel SHALL list all COMPONENT and COMPONENT_SET nodes in the document, grouped under collapsible page sections (expanded by default). These component groups SHALL be wrapped in a top-level collapsible "Components (N)" section where N is the total component count. Below the components section, an "Images (N)" section lists embedded images. Both sections are independently collapsible. When the document has neither components nor images, a combined empty state is shown. The search input filters both sections independently.

#### Scenario: Document with components and images
- **WHEN** the document has 5 components and 3 images
- **THEN** the Assets panel shows "Components (5)" section with page groups and "Images (3)" section with image entries

#### Scenario: Search filters both sections
- **WHEN** user types "btn" in search
- **THEN** components matching "btn" appear under Components, images whose referencing nodes match "btn" appear under Images, empty sections are hidden

#### Scenario: Document with only images
- **WHEN** the document has no components but 2 images
- **THEN** only the "Images (2)" section is shown, no Components section

#### Scenario: Empty document
- **WHEN** the document has no components and no images
- **THEN** a combined empty state is shown: "No assets"
