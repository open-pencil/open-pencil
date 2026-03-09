## ADDED Requirements

### Requirement: Shapes flyout E2E
The E2E suite SHALL verify that the shapes flyout chevron opens a menu with Polygon and Star tools.

#### Scenario: Shapes flyout opens
- **WHEN** the shapes flyout trigger is clicked
- **THEN** the flyout menu is visible with Polygon and Star items

### Requirement: Polygon tool E2E
The E2E suite SHALL verify that selecting Polygon from the flyout and dragging creates a POLYGON node.

#### Scenario: Polygon created
- **WHEN** Polygon is selected from flyout and drag is performed on canvas
- **THEN** a node with type POLYGON exists on the current page

### Requirement: Star tool E2E
The E2E suite SHALL verify that selecting Star from the flyout and dragging creates a STAR node.

#### Scenario: Star created
- **WHEN** Star is selected from flyout and drag is performed on canvas
- **THEN** a node with type STAR exists on the current page

### Requirement: Pen tool corner points E2E
The E2E suite SHALL verify that three clicks with the Pen tool create a VECTOR node with 3 vertices.

#### Scenario: Three clicks create three vertices
- **WHEN** Pen tool is active and three distinct canvas positions are clicked, then Enter pressed (commits open path)
- **THEN** a VECTOR node exists with `vectorNetwork.vertices.length === 3`

### Requirement: Pen tool close path E2E
The E2E suite SHALL verify that clicking the first point of a Pen path closes it.

#### Scenario: Click first point closes path
- **WHEN** Pen tool creates 3 vertices and the user clicks on the first vertex position
- **THEN** the resulting VECTOR node has a closed segment (no open endpoint)

### Requirement: Pen tool Escape cancels path E2E
The E2E suite SHALL verify that pressing Escape during Pen drawing cancels the current path without creating a node.

#### Scenario: Escape cancels open path
- **WHEN** Pen tool creates 2 vertices and Escape is pressed
- **THEN** no new VECTOR node is created on the page (penCancel discards in-progress path)

### Requirement: Frame flyout E2E
The E2E suite SHALL verify that the Frame flyout chevron shows Frame and Section options.

#### Scenario: Frame flyout shows both options
- **WHEN** the frame flyout trigger is clicked
- **THEN** Frame (F) and Section (S) items are visible in the flyout
