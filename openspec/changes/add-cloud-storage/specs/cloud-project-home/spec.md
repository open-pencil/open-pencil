# Spec: cloud-project-home

## ADDED Requirements

### Requirement: Dual-mode startup

When cloud storage is not configured, the application MUST preserve the existing local-first startup (blank editor, no project home). When cloud storage is configured, the application MUST present a files home that lists canvases from the active adapter before requiring the user to open an editor session.

#### Scenario: Unconfigured install opens blank editor

- **WHEN** the user launches the app and cloud storage is not configured
- **THEN** the app MUST show the editor with a blank Untitled document and MUST NOT show an empty project browser shell

#### Scenario: Configured install shows files home

- **WHEN** the user navigates to the app root and cloud storage is configured
- **THEN** the app MUST show the cloud files home listing canvases from the active adapter

### Requirement: Flat canvas list

The files home SHALL present a flat list or grid of canvases (no folder hierarchy in v1), each showing at least a display name and last-updated time when available.

#### Scenario: Empty bucket namespace

- **WHEN** cloud storage is configured and there are no canvases under the namespace
- **THEN** the home MUST show an empty state with an action to create the first canvas

#### Scenario: List load failure

- **WHEN** listing canvases fails
- **THEN** the home MUST show an error state with the failure reason and a way to retry

### Requirement: Create and open canvases from home

The files home SHALL allow creating a new cloud canvas and opening an existing canvas into the editor bound to that cloud identity.

#### Scenario: New canvas

- **WHEN** the user chooses New canvas on the home
- **THEN** the system MUST create a new canvas via the active adapter and open the editor bound to that canvas id

#### Scenario: Open existing canvas

- **WHEN** the user selects a canvas card
- **THEN** the system MUST open the editor with that canvas’s document loaded from the adapter

### Requirement: Rename and delete from home

The files home SHALL allow renaming a canvas (metadata only) and deleting a canvas (hard delete of fig, meta, and thumbnail objects when present).

#### Scenario: Rename

- **WHEN** the user renames a canvas
- **THEN** the display name in cloud metadata MUST update without changing the canvas id / object key identity

#### Scenario: Delete with confirmation

- **WHEN** the user deletes a canvas and confirms
- **THEN** the adapter MUST delete that canvas’s storage objects and the home list MUST refresh without that canvas

### Requirement: Secondary local open

The files home SHALL provide a secondary action to open a local `.fig` / supported file via the existing local file dialog without requiring cloud storage for that document.

#### Scenario: Open local from home

- **WHEN** the user chooses Open local file from the home
- **THEN** the existing local open flow MUST run and the editor MUST open the local document

### Requirement: Return to files from editor

When cloud storage is configured, the editor chrome SHALL provide a control to return to the files home.

#### Scenario: Back to files

- **WHEN** the user is in the editor and cloud storage is configured
- **THEN** a Back to files control MUST navigate to the files home

### Requirement: Automation and file association bypass home

Opening a document via OS file association or automation/MCP MUST open the editor directly and MUST NOT force the user through the files home first.

#### Scenario: Associated file open

- **WHEN** the OS opens a `.fig` with the app while cloud is configured
- **THEN** the editor MUST open that local file without requiring a home detour
