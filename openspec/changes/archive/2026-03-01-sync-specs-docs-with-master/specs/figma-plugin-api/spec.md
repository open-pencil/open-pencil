## ADDED Requirements

### Requirement: Figma-compatible global object

The system SHALL provide a `figma` global object that mirrors Figma's Plugin API surface for headless JavaScript execution.

#### Scenario: Creating figma object
- **WHEN** `new FigmaAPI(sceneGraph)` is instantiated
- **THEN** the object provides methods matching Figma's plugin API (createFrame, createRectangle, createText, etc.)

#### Scenario: Accessing current page
- **WHEN** user accesses `figma.currentPage`
- **THEN** system returns a proxy for the active page with methods like `findAll`, `findOne`, `appendChild`

#### Scenario: Accessing document root
- **WHEN** user accesses `figma.root`
- **THEN** system returns a proxy for the document root containing all pages

### Requirement: Node creation methods

The system SHALL provide creation methods for all supported node types.

#### Scenario: Creating a frame
- **WHEN** user calls `figma.createFrame()`
- **THEN** system creates a FRAME node, adds it to current page, and returns a proxy

#### Scenario: Creating a rectangle
- **WHEN** user calls `figma.createRectangle()`
- **THEN** system creates a RECTANGLE node with default fill

#### Scenario: Creating text
- **WHEN** user calls `figma.createText()`
- **THEN** system creates a TEXT node with default font (Inter Regular 14px)

#### Scenario: Creating other shapes
- **WHEN** user calls `figma.createEllipse()`, `figma.createLine()`, `figma.createPolygon()`, `figma.createStar()`, `figma.createVector()`
- **THEN** system creates corresponding node types

#### Scenario: Creating component
- **WHEN** user calls `figma.createComponent()`
- **THEN** system creates a COMPONENT node

#### Scenario: Creating component set
- **WHEN** user calls `figma.createComponentSet()`
- **THEN** system creates a COMPONENT_SET node

### Requirement: Node proxy with property access

The system SHALL wrap SceneNode objects in proxies that provide Figma-compatible property getters and setters.

#### Scenario: Reading node properties
- **WHEN** user accesses `node.id`, `node.type`, `node.name`, `node.x`, `node.y`, `node.width`, `node.height`
- **THEN** system returns current values from the underlying SceneNode

#### Scenario: Setting node properties
- **WHEN** user sets `node.name = "New Name"` or `node.x = 100`
- **THEN** system updates the SceneNode via SceneGraph.updateNode()

#### Scenario: Reading removed nodes
- **WHEN** user accesses a property on a removed node
- **THEN** system throws "Node <id> has been removed"

### Requirement: Geometry and transforms

The system SHALL provide geometry properties matching Figma's API.

#### Scenario: Basic dimensions
- **WHEN** user accesses `node.width`, `node.height`, `node.rotation`
- **THEN** system returns dimensions and rotation from SceneNode

#### Scenario: Absolute position
- **WHEN** user accesses `node.absoluteTransform`
- **THEN** system returns 2x3 matrix `[[a, b, tx], [c, d, ty]]`

#### Scenario: Absolute bounding box
- **WHEN** user accesses `node.absoluteBoundingBox` or `node.absoluteRenderBounds`
- **THEN** system returns `{x, y, width, height}` in absolute coordinates

#### Scenario: Resizing nodes
- **WHEN** user calls `node.resize(200, 100)`
- **THEN** system updates node width and height

### Requirement: Fill, stroke, and effects

The system SHALL provide Figma-compatible paint and effect properties.

#### Scenario: Reading fills
- **WHEN** user accesses `node.fills`
- **THEN** system returns frozen array of Fill objects

#### Scenario: Setting fills
- **WHEN** user sets `node.fills = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }]`
- **THEN** system updates node fills

#### Scenario: Reading strokes
- **WHEN** user accesses `node.strokes`, `node.strokeWeight`, `node.strokeAlign`
- **THEN** system returns stroke configuration

#### Scenario: Reading effects
- **WHEN** user accesses `node.effects`
- **THEN** system returns frozen array of Effect objects

### Requirement: Text node properties

The system SHALL provide text-specific properties for TEXT nodes.

#### Scenario: Reading text content
- **WHEN** user accesses `textNode.characters`
- **THEN** system returns text content string

#### Scenario: Setting text content
- **WHEN** user sets `textNode.characters = "Hello"`
- **THEN** system updates text content

#### Scenario: Font properties
- **WHEN** user accesses `textNode.fontName`, `textNode.fontSize`, `textNode.fontWeight`
- **THEN** system returns font configuration

#### Scenario: Setting font
- **WHEN** user sets `textNode.fontName = { family: "Inter", style: "Bold" }`
- **THEN** system converts style to weight (700) and updates font

#### Scenario: Text alignment
- **WHEN** user accesses `textNode.textAlignHorizontal`
- **THEN** system returns "LEFT", "CENTER", or "RIGHT"

### Requirement: Auto-layout properties

The system SHALL provide auto-layout (flexbox) properties for frames.

#### Scenario: Reading layout mode
- **WHEN** user accesses `frame.layoutMode`
- **THEN** system returns "NONE", "HORIZONTAL", or "VERTICAL"

#### Scenario: Setting layout mode
- **WHEN** user sets `frame.layoutMode = "VERTICAL"`
- **THEN** system enables auto-layout with vertical direction

#### Scenario: Spacing and padding
- **WHEN** user accesses `frame.itemSpacing`, `frame.paddingLeft`, `frame.paddingTop`, etc.
- **THEN** system returns spacing values

#### Scenario: Layout sizing
- **WHEN** user accesses `node.layoutSizingHorizontal`, `node.layoutSizingVertical`
- **THEN** system returns "FIXED", "HUG", or "FILL"

### Requirement: Tree operations

The system SHALL provide methods for manipulating the scene graph tree.

#### Scenario: Appending child
- **WHEN** user calls `parent.appendChild(child)`
- **THEN** system reparents child to parent

#### Scenario: Inserting child
- **WHEN** user calls `parent.insertChild(2, child)`
- **THEN** system inserts child at index 2 in parent's children

#### Scenario: Accessing children
- **WHEN** user accesses `parent.children`
- **THEN** system returns frozen array of child proxies

#### Scenario: Accessing parent
- **WHEN** user accesses `node.parent`
- **THEN** system returns parent proxy or null for root

#### Scenario: Removing node
- **WHEN** user calls `node.remove()`
- **THEN** system deletes node from scene graph

### Requirement: Traversal and queries

The system SHALL provide methods for finding nodes in the scene graph.

#### Scenario: Finding all matching nodes
- **WHEN** user calls `figma.currentPage.findAll(n => n.type === "FRAME")`
- **THEN** system returns array of proxies for all frames in the page

#### Scenario: Finding first matching node
- **WHEN** user calls `figma.currentPage.findOne(n => n.name === "Button")`
- **THEN** system returns first matching proxy or null

#### Scenario: Finding by ID
- **WHEN** user calls `figma.getNodeById("node-123")`
- **THEN** system returns proxy for that node or null

#### Scenario: Finding with criteria object
- **WHEN** user calls `figma.currentPage.findAllWithCriteria({ types: ["FRAME", "GROUP"] })`
- **THEN** system returns array of proxies matching type criteria

### Requirement: Selection management

The system SHALL track and expose current selection.

#### Scenario: Reading selection
- **WHEN** user accesses `figma.currentPage.selection`
- **THEN** system returns array of selected node proxies

#### Scenario: Setting selection
- **WHEN** user sets `figma.currentPage.selection = [node1, node2]`
- **THEN** system updates editor selection state

### Requirement: Component operations

The system SHALL provide component and instance methods.

#### Scenario: Creating component from node
- **WHEN** user calls `figma.createComponentFromNode(frame)`
- **THEN** system converts frame to COMPONENT and returns proxy

#### Scenario: Creating instance
- **WHEN** user calls `component.createInstance()`
- **THEN** system creates INSTANCE referencing the component

#### Scenario: Swapping instance
- **WHEN** user calls `instance.swapComponent(otherComponent)`
- **THEN** system updates instance's mainComponent reference

### Requirement: Grouping operations

The system SHALL provide grouping methods.

#### Scenario: Grouping nodes
- **WHEN** user calls `figma.group([node1, node2], parent)`
- **THEN** system creates a GROUP containing the nodes

#### Scenario: Ungrouping
- **WHEN** user calls `figma.ungroup(group)`
- **THEN** system removes group and reparents children to group's parent

### Requirement: Corner radius handling

The system SHALL handle both uniform and independent corner radii matching Figma's API.

#### Scenario: Uniform corner radius
- **WHEN** user accesses `rectangle.cornerRadius` and all corners have same radius
- **THEN** system returns that radius value

#### Scenario: Mixed corner radius
- **WHEN** user accesses `rectangle.cornerRadius` and corners have different radii
- **THEN** system returns the MIXED symbol

#### Scenario: Individual corners
- **WHEN** user accesses `rectangle.topLeftRadius`, `rectangle.topRightRadius`, etc.
- **THEN** system returns individual corner radius values

### Requirement: Cloning nodes

The system SHALL support deep cloning of nodes.

#### Scenario: Cloning a node
- **WHEN** user calls `node.clone()`
- **THEN** system creates a deep copy with new GUID and returns proxy

#### Scenario: Cloning with children
- **WHEN** user calls `frame.clone()` on a frame with children
- **THEN** system recursively clones children

### Requirement: JSON serialization

The system SHALL provide JSON export for AI tools and debugging.

#### Scenario: Exporting node to JSON
- **WHEN** user calls `figma.toJSON(node)`
- **THEN** system returns object with `type`, `name`, `id`, geometry, fills, strokes, and recursive children

#### Scenario: Exporting with depth limit
- **WHEN** user calls `figma.toJSON(node, { maxDepth: 2 })`
- **THEN** system includes children only 2 levels deep

### Requirement: Frozen arrays for safety

The system SHALL return frozen arrays for multi-value properties to prevent accidental mutation.

#### Scenario: Fills array is frozen
- **WHEN** user accesses `node.fills` and tries `fills.push(...)`
- **THEN** system throws error (array is frozen)

#### Scenario: Children array is frozen
- **WHEN** user accesses `parent.children` and tries `children[0] = other`
- **THEN** system throws error (array is frozen)

### Requirement: Internal symbols hidden

The system SHALL hide internal implementation details using Symbol properties.

#### Scenario: Internals not enumerable
- **WHEN** user calls `Object.keys(nodeProxy)` or `for (let k in nodeProxy)`
- **THEN** system does not expose INTERNAL_ID, INTERNAL_GRAPH, INTERNAL_API

### Requirement: Variable support

The system SHALL provide access to design variables.

#### Scenario: Listing variables
- **WHEN** user calls `figma.variables.getLocalVariables()`
- **THEN** system returns array of Variable objects

#### Scenario: Listing variable collections
- **WHEN** user calls `figma.variables.getLocalVariableCollections()`
- **THEN** system returns array of VariableCollection objects

#### Scenario: Getting variable by ID
- **WHEN** user calls `figma.variables.getVariableById("var-123")`
- **THEN** system returns Variable object or undefined

### Requirement: Type guards

The system SHALL provide type-checking methods matching Figma's API.

#### Scenario: Checking node type
- **WHEN** user checks `if (node.type === "FRAME")`
- **THEN** system allows type-based branching

### Requirement: Stub methods for unimplemented features

The system SHALL provide stub methods for Figma API methods not yet implemented, throwing descriptive errors.

#### Scenario: Calling unimplemented method
- **WHEN** user calls `figma.createImage(data)` or `figma.createShapeWithText()`
- **THEN** system throws "Not implemented: <method>"

#### Scenario: Notifying user
- **WHEN** user calls `figma.notify("Hello")`
- **THEN** system logs to console (headless mode has no UI notifications)
