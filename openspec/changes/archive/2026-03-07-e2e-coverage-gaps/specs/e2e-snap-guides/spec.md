## ADDED Requirements

### Requirement: Edge snap guide visual E2E
The E2E suite SHALL verify that dragging a node to align its edge with another node causes snap guide lines to appear on the canvas.

#### Scenario: Edge snap guide renders during drag
- **WHEN** two rectangles are positioned such that dragging one aligns its left edge with the other's left edge
- **THEN** a screenshot taken mid-drag (while edges are aligned) contains red guide line pixels not present in the pre-drag screenshot

### Requirement: Center snap guide visual E2E
The E2E suite SHALL verify that dragging a node to align its center with another node causes a center snap guide line to appear.

#### Scenario: Center snap guide renders during drag
- **WHEN** two rectangles are positioned such that dragging one aligns its horizontal center with the other's center
- **THEN** a screenshot taken mid-drag contains guide line pixels indicating center alignment
