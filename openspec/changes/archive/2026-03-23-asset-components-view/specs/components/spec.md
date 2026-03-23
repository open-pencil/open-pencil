## ADDED Requirements

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
