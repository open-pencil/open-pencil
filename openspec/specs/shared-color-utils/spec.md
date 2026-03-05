## ADDED Requirements

### Requirement: colorToCSS exported from core
The `colorToCSS` function SHALL be exported from `packages/core/src/color.ts` and compose with the existing `colorToRgba255` helper. It SHALL convert a `Color` value to a CSS `rgb(r, g, b)` string.

#### Scenario: Converts color to CSS string
- **WHEN** `colorToCSS({ r: 0.96, g: 0.26, b: 0.21, a: 1 })` is called
- **THEN** it returns `"rgb(245, 66, 54)"`

#### Scenario: Available as named import from core
- **WHEN** consumer writes `import { colorToCSS } from '@open-pencil/core'`
- **THEN** the import resolves without error and the function works as expected
