# e2e-properties-panel Specification

## Purpose
TBD - created by archiving change e2e-coverage-gaps. Update Purpose after archive.
## Requirements
### Requirement: ScrubInput drag-to-change E2E
The E2E suite SHALL verify that dragging horizontally on a ScrubInput changes the node property value.

#### Scenario: Drag X ScrubInput moves node
- **WHEN** a rectangle is selected and the X ScrubInput is dragged 50px to the right
- **THEN** `node.x` increases by approximately 50

### Requirement: Corner radius uniform E2E
The E2E suite SHALL verify that typing a corner radius value in the appearance section applies it to all corners.

#### Scenario: Uniform corner radius applied
- **WHEN** a rectangle is selected and a corner radius value is typed into the appearance input
- **THEN** `node.cornerRadius` equals the entered value

### Requirement: Corner radius independent E2E
The E2E suite SHALL verify that toggling to independent corners splits the input into four separate fields.

#### Scenario: Independent corners toggle shows four fields
- **WHEN** the independent corners button is clicked
- **THEN** four corner radius inputs are visible in the panel

### Requirement: Fill gradient switch E2E
The E2E suite SHALL verify that switching fill type to Linear Gradient updates the node fill.

#### Scenario: Fill type switches to gradient
- **WHEN** a rectangle with a solid fill is selected and fill type is changed to LINEAR
- **THEN** `node.fills[0].type` equals `GRADIENT_LINEAR`

### Requirement: Variable bind E2E
The E2E suite SHALL verify that binding a color variable to a fill displays a variable badge.

#### Scenario: Variable badge appears after bind
- **WHEN** a color variable exists and is bound to a node's fill
- **THEN** a variable badge element is visible in the fill section

### Requirement: Alignment buttons E2E
The E2E suite SHALL verify that clicking alignment buttons aligns multiple selected nodes.

#### Scenario: Align left aligns nodes
- **WHEN** two rectangles at different X positions are selected and Align Left is clicked
- **THEN** both nodes have the same `x` coordinate (leftmost of the two)

### Requirement: Flip horizontal E2E
The E2E suite SHALL verify that clicking the flip horizontal button sets `flipX` on the node.

#### Scenario: Flip horizontal toggles
- **WHEN** a rectangle is selected and flip horizontal button is clicked
- **THEN** `node.flipX` is true

### Requirement: Clip content toggle E2E
The E2E suite SHALL verify that the clip content checkbox toggles `clipsContent` on a frame.

#### Scenario: Clip content checkbox toggles
- **WHEN** a frame is selected and the clip content checkbox is clicked
- **THEN** `node.clipsContent` changes to the opposite boolean value

