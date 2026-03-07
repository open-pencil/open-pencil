# userdoc-articles — delta spec (sync-docs-v07-v08)

## Requirement: Stroke align and per-side weights in drawing-shapes article

The drawing-shapes article SHALL document stroke alignment (Inside, Center, Outside) and individual stroke weights per side (Top, Right, Bottom, Left) in the Stroke subsection under Shape Properties.

### Scenario: Stroke align documented
- **WHEN** user reads the Drawing Shapes article
- **THEN** the Stroke section explains Inside/Center/Outside alignment options with a note about clip-based rendering

### Scenario: Per-side stroke weights documented
- **WHEN** user reads the Drawing Shapes article
- **THEN** the Stroke section mentions per-side weight control (Top/Right/Bottom/Left)

## Requirement: Layer inline rename in layers-and-pages article

The layers-and-pages article SHALL document double-click to rename a layer inline. Blur, Enter, or Escape SHALL be described as commit/cancel actions.

### Scenario: Layer rename documented
- **WHEN** user reads the Layers & Pages article
- **THEN** the Layers Panel section mentions double-click to rename with commit/cancel behavior

## Requirement: Copy/Paste as in context-menu article

The context-menu article SHALL have a "Copy/Paste as" section documenting: Copy as text, Copy as SVG, Copy as PNG (⇧⌘C / Shift+Ctrl+C), Copy as JSX.

### Scenario: Copy/Paste as section present
- **WHEN** user reads the Context Menu article
- **THEN** a "Copy/Paste as" section lists all four formats with shortcuts

## Requirement: Mobile layout note in layers-and-pages article

The layers-and-pages article SHALL note that on mobile/small screens panels are accessible via a swipeable bottom drawer.

### Scenario: Mobile note present
- **WHEN** user reads the Layers & Pages article
- **THEN** a brief note explains the mobile bottom drawer layout

## Requirement: Code panel format toggle documented

The layers-and-pages article's Code Tab description SHALL mention the format toggle: OpenPencil JSX (custom components) vs Tailwind CSS v4 (HTML with utility classes).

### Scenario: Format toggle mentioned
- **WHEN** user reads the Properties Panel → Code Tab description
- **THEN** both output formats are mentioned (OpenPencil and Tailwind)

## Requirement: Locale parity for updated articles

The DE, ES, FR, IT, PL translations of `guide/features.md`, `guide/comparison.md`, `guide/figma-comparison.md`, `user-guide/exporting.md`, `user-guide/drawing-shapes.md`, `user-guide/layers-and-pages.md`, and `user-guide/context-menu.md` SHALL be fully updated to match EN content, including all features from v0.5.0–Unreleased.

### Scenario: DE comparison.md matches EN structure
- **WHEN** comparing DE and EN comparison.md
- **THEN** DE has all 11 sections present in EN (not the truncated 128-line version)

### Scenario: All locales show SVG in exporting article
- **WHEN** user reads the Exporting article in any locale
- **THEN** SVG format is listed in the format table

### Scenario: All locales show Copy/Paste as in context-menu
- **WHEN** user reads the Context Menu article in any locale
- **THEN** a Copy/Paste as section is present
