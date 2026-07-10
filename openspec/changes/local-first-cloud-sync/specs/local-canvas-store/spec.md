# Spec: local-canvas-store

## ADDED Requirements

### Requirement: Durable local cache for cloud canvases

When cloud storage is configured, the system SHALL maintain a durable local cache of cloud-bound canvases including at least: canvas id, provider id, display name, updatedAt, revision, sync status, and document bytes (`.fig`).

#### Scenario: Persist after save

- **WHEN** a cloud-bound document is saved or autosaved
- **THEN** the local canvas store MUST write the latest `.fig` bytes and metadata before the save operation is considered successful for the editor

#### Scenario: Survive refresh

- **WHEN** the user reloads the app after a successful local save and before remote sync completes
- **THEN** the local canvas store MUST still return the saved document bytes and a non-synced status (`pending` or equivalent)

### Requirement: Local storage medium for large documents

The local canvas store MUST store multi-megabyte document bytes in a durable browser/desktop file-oriented store suitable for large binaries (OPFS or Tauri app data), and MUST NOT store document bodies in `localStorage`.

#### Scenario: Large fig accepted

- **WHEN** a canvas document of several megabytes is written to the local store
- **THEN** the write MUST succeed without using `localStorage` for the document body

### Requirement: Local canvases index

The local canvas store SHALL expose a list of known canvases (id, name, updatedAt, syncStatus, optional thumb reference) suitable for rendering Files home without a network round-trip.

#### Scenario: Instant list

- **WHEN** Files home loads and the local index has entries
- **THEN** the system MUST be able to render those entries without calling the remote adapter list API first

### Requirement: Sync status on records

Each local canvas record MUST carry a sync status of at least: `synced`, `pending`, `error`, and (when multi-device is enabled) `conflict`.

#### Scenario: Dirty after local edit

- **WHEN** local document bytes change for a canvas
- **THEN** that record’s sync status MUST become `pending` until the sync engine marks it synced or failed

### Requirement: Unconfigured cloud leaves local mirror off

When cloud storage is not configured, the system MUST NOT require initializing a cloud local canvas mirror for normal editor use.

#### Scenario: No credentials

- **WHEN** cloud credentials are empty
- **THEN** the app MUST behave as today for startup and local file open/save without creating cloud cache state as a prerequisite
