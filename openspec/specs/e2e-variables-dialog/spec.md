# e2e-variables-dialog Specification

## Purpose
TBD - created by archiving change e2e-coverage-gaps. Update Purpose after archive.
## Requirements
### Requirement: Variables dialog open E2E
The E2E suite SHALL verify that the variables dialog can be opened when no node is selected.

#### Scenario: Variables dialog opens
- **WHEN** no node is selected and the variables settings button is activated
- **THEN** a dialog element with variables table is visible

### Requirement: Variables dialog search E2E
The E2E suite SHALL verify that typing in the search field filters the variables table.

#### Scenario: Search filters variable rows
- **WHEN** variables exist with different names and a search term is typed
- **THEN** only rows whose names match the search term are visible

### Requirement: Variables dialog edit value E2E
The E2E suite SHALL verify that clicking a variable value cell makes it editable.

#### Scenario: Click cell to edit
- **WHEN** a variable value cell is clicked in the dialog
- **THEN** an input field is focused in that cell

### Requirement: Color variable picker E2E
The E2E suite SHALL verify that clicking a color variable swatch opens a color picker.

#### Scenario: Color swatch opens picker
- **WHEN** a color variable's swatch is clicked in the dialog
- **THEN** a color picker element becomes visible

