# Spec: cloud-document-source

## ADDED Requirements

### Requirement: Cloud document binding

The document I/O layer SHALL support binding an editor tab to a cloud canvas identity `{ providerId, canvasId }` as a first-class writable source, mutually exclusive with local path/handle sources.

#### Scenario: Bind on cloud open

- **WHEN** a cloud canvas is opened into a tab
- **THEN** the tab’s document source MUST be the cloud binding for that canvas and local path/handle MUST be cleared

#### Scenario: Bind on cloud create

- **WHEN** a new cloud canvas is created
- **THEN** the tab MUST be bound to the new canvas id and the document name MUST match the canvas display name

### Requirement: Save writes through the adapter

When a tab is cloud-bound, Save MUST serialize the document as `.fig` and write it through the active adapter’s put operation, including updated metadata (name and timestamp).

#### Scenario: Manual save of cloud document

- **WHEN** the user saves a cloud-bound document
- **THEN** the system MUST call the active adapter to put the `.fig` bytes and metadata for that canvas id

#### Scenario: Adapter mismatch or missing config

- **WHEN** a tab is cloud-bound but the active adapter is missing or its provider id does not match the binding
- **THEN** save MUST fail with a clear error and MUST NOT silently write elsewhere

### Requirement: Autosave for cloud documents

Cloud-bound documents SHALL treat cloud storage as a writable source for autosave. Autosave MUST be enabled by default when a document is bound to cloud from the files home flow.

#### Scenario: Autosave after edits

- **WHEN** a cloud-bound document has autosave enabled and the scene version changes
- **THEN** after the existing autosave debounce the system MUST put the updated document to the active adapter if the version is still dirty

### Requirement: Cloud as source of truth when configured for that canvas

For canvases opened or created via the cloud home, the durable storage location MUST be the cloud object under the OpenPencil namespace, not a local path, unless the user explicitly uses Save As to a local target.

#### Scenario: Save As local detaches cloud binding

- **WHEN** the user performs Save As to a local path or file handle on a previously cloud-bound document
- **THEN** the cloud binding MUST be cleared and subsequent saves MUST use the local target

### Requirement: Open loads fig bytes from adapter

Opening a cloud canvas MUST download `.fig` bytes via the adapter and load them with the existing fig import pipeline.

#### Scenario: Successful open

- **WHEN** the adapter returns fig bytes for a canvas id
- **THEN** the editor MUST replace the graph with the imported document and set the document name from cloud metadata when available

#### Scenario: Missing canvas

- **WHEN** the adapter cannot find the canvas
- **THEN** the open MUST fail with a user-visible error and MUST NOT leave a silently empty bound document without feedback
