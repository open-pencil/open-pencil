## ADDED Requirements

### Requirement: Export format selection E2E
The E2E suite SHALL verify that changing the export format selector updates the format value in the export section.

#### Scenario: Format selector changes to JPG
- **WHEN** a node with an export setting is selected and the format selector is changed to JPG
- **THEN** the export row displays JPG as the selected format

### Requirement: Export multi-row add/remove E2E
The E2E suite SHALL verify that clicking + adds a new export row and − removes it.

#### Scenario: Add export row
- **WHEN** a node is selected and the + button in ExportSection is clicked
- **THEN** one more export setting row is visible than before

#### Scenario: Remove export row
- **WHEN** a node has two export rows and the − button on one row is clicked
- **THEN** only one export row remains

### Requirement: Export preview toggle E2E
The E2E suite SHALL verify that clicking the Preview button shows a preview image element.

#### Scenario: Preview button shows image
- **WHEN** a node with an export setting is selected and the Preview button is clicked
- **THEN** an image element (checkerboard preview) becomes visible in the export section

### Requirement: SVG format hides scale selector E2E
The E2E suite SHALL verify that when SVG format is selected, the scale (multiplier) selector is hidden.

#### Scenario: SVG hides scale input
- **WHEN** an export row format is set to SVG
- **THEN** no scale/multiplier input is visible for that row
