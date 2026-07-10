# Spec: cloud-project-home (delta)

## MODIFIED Requirements

### Requirement: Files home lists canvases

When cloud storage is configured, Files home MUST show the user’s canvases. The initial paint MUST come from the local canvas index when available. The system MUST reconcile with the remote adapter list in the background and update the UI when the merge completes.

#### Scenario: Instant local paint

- **WHEN** the user opens Files home and local index entries exist
- **THEN** those entries MUST appear without waiting for remote list success

#### Scenario: Background reconcile

- **WHEN** remote list succeeds after local paint
- **THEN** the UI MUST merge remote-only canvases into the list and refresh metadata for matched ids according to sync rules

#### Scenario: Remote list failure

- **WHEN** remote list fails but local index has entries
- **THEN** the home MUST still show local entries and MAY show a non-blocking sync/connectivity warning

## ADDED Requirements

### Requirement: Create and import are local-first

Creating a new fig or importing a local file into cloud home MUST create/update the local canvas store first (document + meta + best-effort thumb), show the card immediately, and enqueue remote puts.

#### Scenario: New fig

- **WHEN** the user creates a new fig from Files home
- **THEN** a local canvas record MUST exist with status `pending` before remote put completes

#### Scenario: Import fig

- **WHEN** the user imports a valid `.fig`
- **THEN** the file MUST be written to the local store and appear in the grid without waiting for remote upload completion

### Requirement: Sync affordances on cards

Files home cards MUST be able to reflect non-synced state (`pending`, `error`, `conflict`) with a subtle visual affordance, without blocking open/rename/delete.

#### Scenario: Pending upload

- **WHEN** a canvas has sync status `pending`
- **THEN** the card MUST remain openable and SHOULD indicate syncing/pending state

### Requirement: Open from home uses local-first open path

Opening a card from Files home MUST use the cloud-document-source open rules (local cache first, remote on miss).

#### Scenario: Open pending canvas offline

- **WHEN** the user opens a canvas that exists locally while offline
- **THEN** the editor MUST open the local document successfully
