# e2e-panels Specification

## Purpose
TBD - created by archiving change e2e-coverage-gaps. Update Purpose after archive.
## Requirements
### Requirement: Layers panel resize E2E
The E2E suite SHALL verify that dragging the resize handle between the left panel and canvas changes the panel width.

#### Scenario: Panel resize handle changes width
- **WHEN** the splitter handle on the left panel is dragged 80px to the right
- **THEN** the layers panel DOM element has a wider width than before the drag

### Requirement: UI toggle persistence across reload E2E
The E2E suite SHALL verify that panel sizes are preserved after a page reload.

#### Scenario: Panel width persists after reload
- **WHEN** the layers panel is resized and the page is reloaded
- **THEN** the panel width after reload matches the width set before reload (within 2px)

### Requirement: ⌘\\ hides and shows panels E2E
The E2E suite SHALL verify that pressing ⌘\\ toggles the visibility of the left and right panels.

#### Scenario: Cmd+Backslash hides panels
- **WHEN** ⌘\\ is pressed while panels are visible
- **THEN** the layers panel and properties panel elements are not visible in the DOM

#### Scenario: Cmd+Backslash shows panels again
- **WHEN** ⌘\\ is pressed while panels are hidden
- **THEN** the layers panel and properties panel elements are visible again

