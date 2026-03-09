## ADDED Requirements

### Requirement: Safari save fallback
The editor SHALL support saving in Safari and browsers without File System Access API by creating a download link (`<a>` appended to DOM) with deferred `revokeObjectURL`.

#### Scenario: Save in Safari
- **WHEN** user presses ⌘S in Safari (no showSaveFilePicker)
- **THEN** system creates a blob URL, appends an anchor to DOM, triggers click, and defers revocation

### Requirement: Safari compatibility banner
The editor SHALL display a dismissible banner when running in Safari (or browsers without File System Access API), explaining limitations and suggesting Chrome/Edge.

#### Scenario: Banner shown
- **WHEN** user opens the app in Safari
- **THEN** a banner appears explaining File System Access limitations

#### Scenario: Banner dismissal persisted
- **WHEN** user dismisses the banner
- **THEN** dismissal is saved to localStorage and banner does not reappear
