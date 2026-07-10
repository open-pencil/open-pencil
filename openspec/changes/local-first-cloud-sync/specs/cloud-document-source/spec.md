# Spec: cloud-document-source (delta)

## MODIFIED Requirements

### Requirement: Save writes through the adapter

When a tab is cloud-bound, Save and autosave MUST serialize the document as `.fig`, persist it to the local canvas store as the immediate durable write, mark the canvas pending sync, and enqueue a remote put through the sync engine / active adapter. The editor save path MUST NOT await a successful remote PUT before treating the document as saved.

#### Scenario: Manual save of cloud document

- **WHEN** the user saves a cloud-bound document
- **THEN** the system MUST write `.fig` bytes and metadata to the local canvas store for that canvas id and enqueue a remote put
- **AND** the editor MUST advance saved state without waiting for the remote put to finish

#### Scenario: Autosave after edits

- **WHEN** a cloud-bound document has autosave enabled and the scene version changes
- **THEN** after the existing autosave debounce the system MUST perform the same local-first save path as manual save

#### Scenario: Adapter mismatch or missing config

- **WHEN** a tab is cloud-bound but the active adapter is missing or its provider id does not match the binding
- **THEN** save MUST fail with a clear error and MUST NOT silently write to an unrelated target

### Requirement: Cloud as source of truth when configured for that canvas

For canvases opened or created via the cloud home, the **eventual** durable remote location MUST remain the cloud object under the OpenPencil namespace. The **immediate** durable location for the open session MUST be the local canvas store. Explicit Save As to a local path still detaches the cloud binding.

#### Scenario: Save As local detaches cloud binding

- **WHEN** the user performs Save As to a local path or file handle on a previously cloud-bound document
- **THEN** the cloud binding MUST be cleared and subsequent saves MUST use the local target

#### Scenario: Remote durability after sync

- **WHEN** a pending local save has been successfully processed by the sync engine
- **THEN** the remote adapter objects for that canvas id MUST match the local document metadata and bytes (aside from acceptable thumbnail lag)

### Requirement: Open loads fig bytes from adapter

Opening a cloud canvas MUST load `.fig` bytes from the local canvas store when present; otherwise it MUST download via the adapter, seed the local store, then load with the existing fig import pipeline.

#### Scenario: Open from local cache

- **WHEN** the user opens a cloud canvas that has local document bytes
- **THEN** the editor MUST load those bytes without requiring a successful remote get first

#### Scenario: Open cache miss

- **WHEN** the user opens a cloud canvas with no local document bytes
- **THEN** the system MUST download via the adapter, write the local store, and open the imported graph

#### Scenario: Missing canvas

- **WHEN** neither local nor remote document bytes are available
- **THEN** open MUST fail with a clear error

## ADDED Requirements

### Requirement: Thumbnail regeneration on local save

When a cloud-bound document is saved, the system MUST attempt to generate or update a local thumbnail representing the canvas and enqueue a remote thumbnail put when generation succeeds. Thumbnail work MUST NOT block considering the document saved.

#### Scenario: Save with renderer available

- **WHEN** the user saves and a live renderer can produce a page thumbnail
- **THEN** the local thumb MUST update and a put-thumb job MUST be enqueued without failing the save if thumb upload is still pending
