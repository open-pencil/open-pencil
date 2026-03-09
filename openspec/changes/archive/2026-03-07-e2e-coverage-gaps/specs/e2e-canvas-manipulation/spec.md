## ADDED Requirements

### Requirement: Marquee selection E2E
The E2E suite SHALL verify that dragging from an empty canvas area selects all nodes whose bounds intersect the drag rectangle.

#### Scenario: Marquee selects intersected nodes
- **WHEN** two rectangles are drawn and mouse is dragged from a point before both to a point after both
- **THEN** both nodes appear in `store.state.selectedIds`

#### Scenario: Marquee on empty area deselects
- **WHEN** a node is selected and mouse is dragged across empty canvas
- **THEN** `store.state.selectedIds.size` equals 0

### Requirement: Resize handles E2E
The E2E suite SHALL verify that dragging a resize handle changes the node's width and height.

#### Scenario: Corner resize increases dimensions
- **WHEN** a rectangle is selected and its bottom-right corner handle is dragged 50px right and 50px down
- **THEN** node width and height each increase by approximately 50px

### Requirement: Rotation handle E2E
The E2E suite SHALL verify that the rotation handle rotates a node.

#### Scenario: Rotation changes node rotation
- **WHEN** a rectangle is selected and the cursor is positioned just outside a corner, then dragged in an arc
- **THEN** `node.rotation` is non-zero

### Requirement: Alt+drag duplicate E2E
The E2E suite SHALL verify that Alt+drag creates a copy of the node.

#### Scenario: Alt drag creates duplicate
- **WHEN** a rectangle is selected and dragged with Alt held
- **THEN** the page has one more node than before the drag

### Requirement: Shift+Arrow nudge E2E
The E2E suite SHALL verify that Shift+Arrow nudges a node by 10px.

#### Scenario: Shift+ArrowRight nudges 10px
- **WHEN** a node is selected and Shift+ArrowRight is pressed
- **THEN** `node.x` increases by 10

### Requirement: Hover highlight E2E
The E2E suite SHALL verify that hovering over a node (without clicking) triggers a visible highlight outline on the canvas.

#### Scenario: Hover renders highlight
- **WHEN** the mouse moves over a rectangle without clicking
- **THEN** a screenshot taken during hover differs from a screenshot taken with the mouse away (highlight outline visible)
