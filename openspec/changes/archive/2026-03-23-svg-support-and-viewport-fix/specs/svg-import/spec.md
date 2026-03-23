## ADDED Requirements

### Requirement: SVG file drag-and-drop from OS
The editor SHALL accept SVG files (`image/svg+xml`) dragged from the operating system onto the canvas. The SVG SHALL be parsed into a FRAME node containing VECTOR children using the existing `extractPaths` + `parseSVGPath` pipeline. The SVG raw bytes SHALL also be stored in `graph.images` for round-trip and Assets display.

#### Scenario: Drop SVG file on canvas
- **WHEN** user drags a .svg file from OS file manager onto the canvas at (400, 300)
- **THEN** a FRAME with VECTOR children is created at canvas coordinates, representing the SVG shapes

#### Scenario: SVG with multiple shapes
- **WHEN** an SVG contains 3 path elements and a circle
- **THEN** the resulting FRAME has 4 VECTOR children

### Requirement: parseSVGFile utility in core
`@open-pencil/core` SHALL export a `parseSVGFile(svgText: string, targetSize?: number)` function that parses a full SVG string (with `<svg>` wrapper) and returns `IconData` with paths ready for `createIconFromPaths()`. The function SHALL extract viewBox dimensions and scale paths to targetSize if provided.

#### Scenario: Parse SVG with viewBox
- **WHEN** `parseSVGFile('<svg viewBox="0 0 100 100"><path d="M10 10L90 90"/></svg>')` is called
- **THEN** an `IconData` with one path and width=100, height=100 is returned
