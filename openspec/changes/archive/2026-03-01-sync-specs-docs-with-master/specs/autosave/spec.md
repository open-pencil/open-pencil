## ADDED Requirements

### Requirement: Automatic file saving with debounce

The system SHALL automatically save the current document 3 seconds after the last scene change.

#### Scenario: Triggering autosave
- **WHEN** user modifies scene graph (e.g., moves node, changes fill)
- **THEN** system starts 3-second timer

#### Scenario: Debouncing saves
- **WHEN** user makes multiple changes within 3 seconds
- **THEN** system resets timer on each change, saving only after 3 seconds of inactivity

#### Scenario: Writing file
- **WHEN** autosave timer expires
- **THEN** system calls `writeFile(buildFigFile())` to persist document

### Requirement: Watch sceneVersion for changes

The system SHALL monitor `state.sceneVersion` to detect modifications.

#### Scenario: Detecting changes
- **WHEN** `state.sceneVersion` increments (scene graph mutation)
- **THEN** system triggers autosave timer

#### Scenario: No save on unchanged document
- **WHEN** autosave timer expires but `sceneVersion === savedVersion`
- **THEN** system skips write (no changes since last save)

### Requirement: Disable for new unsaved files

The system SHALL not autosave documents without a file handle.

#### Scenario: New untitled document
- **WHEN** document has no associated file path or handle
- **THEN** system skips autosave (user must explicitly Save As)

#### Scenario: After Save As
- **WHEN** user performs Save As and sets file handle
- **THEN** system enables autosave for future changes

### Requirement: Use VueUse debounce

The system SHALL use `useDebounceFn` from VueUse for debouncing logic.

#### Scenario: Debounce implementation
- **WHEN** system sets up autosave watcher
- **THEN** system wraps save logic with `useDebounceFn(fn, 3000)`

### Requirement: Cross-platform file writing

The system SHALL support both Tauri and browser File System Access API.

#### Scenario: Tauri file write
- **WHEN** running in Tauri desktop app
- **THEN** system uses Tauri fs plugin to write file

#### Scenario: Browser file write
- **WHEN** running in browser with File System Access support
- **THEN** system uses FileHandle.createWritable() to write

#### Scenario: Fallback for unsupported browsers
- **WHEN** browser lacks File System Access API
- **THEN** system disables autosave (manual save only)

### Requirement: Silent failure handling

The system SHALL silently handle autosave errors without interrupting user.

#### Scenario: Write failure
- **WHEN** autosave encounters file write error (permissions, disk full)
- **THEN** system logs error silently without showing error dialog

#### Scenario: User can still manual save
- **WHEN** autosave fails
- **THEN** user can still manually trigger Save (⌘S) to retry

### Requirement: Update savedVersion after successful write

The system SHALL track last saved version to avoid redundant writes.

#### Scenario: Recording save
- **WHEN** autosave successfully writes file
- **THEN** system sets `savedVersion = state.sceneVersion`

#### Scenario: No duplicate saves
- **WHEN** autosave timer expires but versions match
- **THEN** system skips write operation

### Requirement: Configurable delay

The system SHALL use a constant `AUTOSAVE_DELAY = 3000` (3 seconds).

#### Scenario: Delay constant
- **WHEN** system sets up autosave
- **THEN** debounce delay is 3000ms (configurable via constant)

### Requirement: Cleanup on unmount

The system SHALL cancel pending autosave timers when editor unmounts.

#### Scenario: Component cleanup
- **WHEN** editor component unmounts or file closes
- **THEN** system clears timeout to prevent orphaned saves

### Requirement: Integration with editor store

The system SHALL integrate autosave into `useEditorStore` reactive state.

#### Scenario: Reactive watcher
- **WHEN** editor store initializes
- **THEN** system sets up `watch(() => state.sceneVersion, ...)` to trigger autosave

#### Scenario: Manual save updates savedVersion
- **WHEN** user manually saves (⌘S or Save As)
- **THEN** system updates `savedVersion` to prevent immediate autosave
