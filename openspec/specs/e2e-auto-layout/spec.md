# e2e-auto-layout Specification

## Purpose
TBD - created by archiving change e2e-coverage-gaps. Update Purpose after archive.
## Requirements
### Requirement: Auto-layout Shift+A on selection E2E
The E2E suite SHALL verify that Shift+A on multiple selected nodes wraps them in an auto-layout frame.

#### Scenario: Shift+A wraps nodes in auto-layout frame
- **WHEN** two rectangles are selected and Shift+A is pressed
- **THEN** a single FRAME node exists on the page with `layoutMode` set to `HORIZONTAL` or `VERTICAL` and the rectangles are its children

### Requirement: Auto-layout direction toggle E2E
The E2E suite SHALL verify that clicking the horizontal/vertical direction buttons changes `layoutMode`.

#### Scenario: Direction button toggles layoutMode
- **WHEN** an auto-layout frame is selected and the vertical direction button is clicked in LayoutSection
- **THEN** `frame.layoutMode` equals `VERTICAL`

### Requirement: Auto-layout gap E2E
The E2E suite SHALL verify that changing the gap ScrubInput updates `itemSpacing`.

#### Scenario: Gap ScrubInput changes itemSpacing
- **WHEN** an auto-layout frame is selected and the gap ScrubInput value is changed to 20
- **THEN** `frame.itemSpacing` equals 20

### Requirement: Auto-layout padding uniform E2E
The E2E suite SHALL verify that changing the uniform padding input updates all four padding properties.

#### Scenario: Uniform padding updates all sides
- **WHEN** an auto-layout frame is selected and padding is set to 16
- **THEN** `frame.paddingTop`, `frame.paddingRight`, `frame.paddingBottom`, and `frame.paddingLeft` all equal 16

### Requirement: Auto-layout alignment grid E2E
The E2E suite SHALL verify that clicking a cell in the 3×3 alignment grid updates `primaryAxisAlign` and `counterAxisAlign`.

#### Scenario: Center-center alignment set
- **WHEN** the center-center cell of the alignment grid is clicked
- **THEN** `frame.primaryAxisAlign` equals `CENTER` and `frame.counterAxisAlign` equals `CENTER`

### Requirement: Auto-layout remove E2E
The E2E suite SHALL verify that clicking the remove (−) button in the auto-layout section sets `layoutMode` to NONE.

#### Scenario: Remove auto-layout resets layoutMode
- **WHEN** an auto-layout frame is selected and the remove auto-layout button is clicked
- **THEN** `frame.layoutMode` equals `NONE`

