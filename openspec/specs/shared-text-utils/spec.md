## ADDED Requirements

### Requirement: initials utility in src/utils/text.ts
The `initials` function SHALL be exported from `src/utils/text.ts`. It SHALL take a name string and return up to 2 uppercase initials, falling back to `"?"` for empty input.

#### Scenario: Two-word name
- **WHEN** `initials("John Doe")` is called
- **THEN** it returns `"JD"`

#### Scenario: Single word
- **WHEN** `initials("Alice")` is called
- **THEN** it returns `"A"`

#### Scenario: Empty string fallback
- **WHEN** `initials("")` is called
- **THEN** it returns `"?"`
