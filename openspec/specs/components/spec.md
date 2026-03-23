# components Specification

## Purpose
Components, component sets, instances — create, instantiate, detach, go-to-main component, component labels, opaque container hit testing.
## Requirements

### Requirement: Create component from selection
The editor SHALL convert selected frames/groups to COMPONENT type, or wrap multiple selected nodes in a new COMPONENT node (⌥⌘K). Single frame/group converts in-place; multiple nodes wraps in a bounding component.

#### Scenario: Convert frame to component
- **WHEN** user selects a single frame and presses ⌥⌘K
- **THEN** the frame's type changes to COMPONENT

#### Scenario: Wrap multiple nodes in component
- **WHEN** user selects three rectangles and presses ⌥⌘K
- **THEN** a COMPONENT node wraps them, positioned at their bounding box

### Requirement: Create component set from components
The editor SHALL combine multiple selected COMPONENT nodes into a COMPONENT_SET container (⇧⌘K). The set gets a dashed purple border and a 40px padding around its children.

#### Scenario: Create component set
- **WHEN** user selects two COMPONENT nodes and presses ⇧⌘K
- **THEN** a COMPONENT_SET wraps them with dashed purple border

### Requirement: Create instance from component
The editor SHALL create an INSTANCE node from a COMPONENT via context menu, copying its visual properties and deep-cloning children with `componentId` mapping. The instance is placed 40px to the right of the source component. Instance creation is available only through the context menu (no button in properties panel).

#### Scenario: Create instance via context menu
- **WHEN** user right-clicks a component and selects "Create instance"
- **THEN** an INSTANCE appears to the right, visually identical to the component

#### Scenario: Instance children have componentId mapping
- **WHEN** an instance is created from a component with children [A, B]
- **THEN** instance children have `componentId` pointing to A and B respectively

### Requirement: Detach instance
The editor SHALL convert an INSTANCE back to a regular FRAME, clearing its componentId and overrides (⌥⌘B).

#### Scenario: Detach instance
- **WHEN** user selects an instance and presses ⌥⌘B
- **THEN** the instance becomes a FRAME with no component link

### Requirement: Go to main component
The editor SHALL navigate to and select the main COMPONENT for a selected INSTANCE, switching pages if needed.

#### Scenario: Navigate to main component
- **WHEN** user right-clicks an instance and selects "Go to main component"
- **THEN** the main component is selected and centered in the viewport

### Requirement: Component labels
The renderer SHALL draw always-visible purple labels above COMPONENT and INSTANCE nodes (or inside COMPONENT_SET children). Labels show the node name with a diamond icon.

#### Scenario: Component label visible
- **WHEN** a COMPONENT node exists on canvas
- **THEN** a purple label with the component name is rendered above it

### Requirement: Component set visual treatment
COMPONENT_SET nodes SHALL render with a dashed purple border (6px dash, 4px gap, 1.5px width) instead of a solid border.

#### Scenario: Component set border
- **WHEN** a COMPONENT_SET is on canvas
- **THEN** it renders with a dashed purple border

### Requirement: Opaque container hit testing
COMPONENT and INSTANCE nodes SHALL behave as opaque containers for hit testing — clicking selects the component/instance itself, not its children. Children are accessible only via double-click (deep hit test).

#### Scenario: Click on component child
- **WHEN** user clicks a rectangle inside a component
- **THEN** the component is selected, not the rectangle

#### Scenario: Double-click into component
- **WHEN** user double-clicks a child inside a component
- **THEN** the child is selected (deep selection)

### Requirement: Live component-instance sync
The scene graph SHALL propagate property changes from a COMPONENT to all its INSTANCE nodes. Synced properties include: width, height, fills, strokes, effects, opacity, corner radii, layout properties, and clipsContent. The store SHALL auto-trigger sync after `updateNode`, `commitMove`, and `commitResize` when the edited node is inside a COMPONENT.

#### Scenario: Edit component updates instances
- **WHEN** user changes the fill color of a main component
- **THEN** all instances of that component update to the new fill color

#### Scenario: Resize component syncs to instances
- **WHEN** user resizes a main component
- **THEN** all instances resize to match

### Requirement: Override preservation during sync
Instances SHALL maintain an `overrides` record. When syncing, properties marked in overrides are skipped. Child-level overrides use `${childId}:${propertyKey}` keys. Overridable child properties include name, text, fontSize, fontWeight, fontFamily, plus all synced visual/layout properties.

#### Scenario: Override preserved during sync
- **WHEN** an instance child has text overridden to "Custom" and the component child text changes to "New Default"
- **THEN** the instance child's text remains "Custom" while non-overridden properties sync

### Requirement: New children propagate to instances
When a new child is added to a COMPONENT, sync SHALL clone the new child into all existing instances.

#### Scenario: Add child to component
- **WHEN** user adds a new rectangle inside a component that has two instances
- **THEN** both instances gain a cloned copy of the new rectangle

### Requirement: Instance child order matches component
After sync, instance children SHALL be reordered to match the component's child order.

#### Scenario: Reorder component children
- **WHEN** component children are reordered from [A, B] to [B, A]
- **THEN** after sync, instance children reflect the new order


### Requirement: SceneGraph component enumeration by page
SceneGraph SHALL provide a `getComponentsGroupedByPage()` method returning `Array<{ page: SceneNode; components: SceneNode[] }>`. The method traverses all pages, recursively walks child trees (frames, groups, sections), and collects nodes with `type === 'COMPONENT'` or `type === 'COMPONENT_SET'`. It does NOT recurse into COMPONENT_SET children (those are variants, accessed separately). Pages with no components are omitted. The traversal uses an iterative stack (not recursion) for predictable performance.

#### Scenario: Components on multiple pages
- **WHEN** `getComponentsGroupedByPage()` is called on a document with 2 components on Page 1 and 1 on Page 2
- **THEN** the result has two entries: `[{ page: Page1, components: [C1, C2] }, { page: Page2, components: [C3] }]`

#### Scenario: No components in document
- **WHEN** `getComponentsGroupedByPage()` is called on a document with only rectangles and frames
- **THEN** the result is an empty array

#### Scenario: Component nested inside a frame
- **WHEN** a COMPONENT exists inside a frame → group → page
- **THEN** the component is found and included in that page's components array

#### Scenario: COMPONENT_SET children not duplicated
- **WHEN** a COMPONENT_SET has 3 COMPONENT children (variants)
- **THEN** only the COMPONENT_SET appears in the result, not its children

#### Scenario: INSTANCE nodes excluded
- **WHEN** the page has both COMPONENT and INSTANCE nodes
- **THEN** only COMPONENT nodes appear in the result

### Requirement: Focus node with viewport navigation
The editor store SHALL provide a `focusNode(nodeId: string)` method that: (1) finds which page the node is on by walking parentId chain up to type === 'CANVAS', (2) switches page via `switchPage()` if different from current, (3) sets `selectedIds` to the node, (4) centers the viewport on the node using `window.innerWidth/Height` (not hardcoded dimensions), (5) calls `requestRender()`. The existing `goToMainComponent()` SHALL be refactored to call `focusNode()` instead of duplicating the viewport math.

#### Scenario: Focus node on current page
- **WHEN** `focusNode(nodeId)` is called for a node on the current page
- **THEN** the viewport centers on the node and it is selected, no page switch

#### Scenario: Focus node on different page
- **WHEN** `focusNode(nodeId)` is called for a node on Page 2 while viewing Page 1
- **THEN** the editor switches to Page 2, centers viewport, and selects the node

#### Scenario: goToMainComponent uses focusNode
- **WHEN** `goToMainComponent()` is called on a selected instance
- **THEN** it resolves the main component and calls `focusNode(mainComponentId)`

### Requirement: Cross-page instance creation
`createInstanceFromComponent(componentId, x?, y?, targetPageId?)` SHALL accept an optional `targetPageId` parameter. When provided, the instance is created on the target page. When omitted, it defaults to `state.currentPageId`. This replaces the current behavior of using `component.parentId` which breaks cross-page drag-and-drop.

#### Scenario: Create instance on current page from cross-page component
- **WHEN** a component on Page 2 is used to create an instance while viewing Page 1, with `targetPageId = Page1.id`
- **THEN** the instance appears on Page 1

#### Scenario: Default behavior unchanged
- **WHEN** `createInstanceFromComponent(id, x, y)` is called without targetPageId
- **THEN** the instance is created on `state.currentPageId`

### Requirement: Store-level component thumbnail rendering
The editor store SHALL provide a `renderComponentThumbnail(nodeId: string, size?: number): string | null` method that renders a component node as a PNG blob URL. It finds the node's page ID, calls `renderNodesToImage()` with the private `_ck` and `_renderer`, creates a Blob, and returns `URL.createObjectURL()`. Returns `null` if CanvasKit is not initialized or the node doesn't exist.

#### Scenario: Render thumbnail for component
- **WHEN** `renderComponentThumbnail(componentId)` is called for a visible COMPONENT
- **THEN** a blob URL pointing to a PNG image is returned

#### Scenario: CanvasKit not initialized
- **WHEN** `renderComponentThumbnail()` is called before `setCanvasKit()`
- **THEN** it returns `null`

### Requirement: MCP system prompt mentions component discovery
The `ACP_DESIGN_CONTEXT` system prompt SHALL include `get_components` and `create_instance` in the key tools list, enabling AI agents to discover and reuse existing components.

#### Scenario: System prompt content
- **WHEN** `ACP_DESIGN_CONTEXT` is read
- **THEN** it contains mentions of `get_components` for listing components and `create_instance` for creating instances
