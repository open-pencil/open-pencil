# Spec: cloud-sync-engine

## ADDED Requirements

### Requirement: Durable outbox for remote operations

The system SHALL queue remote cloud operations (at least put document, put thumbnail, delete canvas) in a durable outbox that survives page reloads until acknowledged as completed or cancelled.

#### Scenario: Enqueue on local save

- **WHEN** a cloud-bound document is saved to the local canvas store
- **THEN** the system MUST enqueue a put-document job (and put-thumbnail when a thumb is produced) for that canvas id

#### Scenario: Reload mid-flight

- **WHEN** the app reloads while put jobs remain unfinished
- **THEN** the sync engine MUST resume processing those jobs without user action

### Requirement: Background drain without blocking the editor

The sync engine MUST process the outbox asynchronously. Editor save success MUST NOT depend on a successful remote PUT.

#### Scenario: Network down during save

- **WHEN** the user saves while offline
- **THEN** the editor MUST complete local save successfully and the outbox MUST retain the job for later retry

### Requirement: Retry with backoff

Transient network and server failures MUST be retried with exponential backoff. Permanent credential/configuration failures MUST eventually mark the canvas sync status as `error` and surface a non-blocking status to the user.

#### Scenario: Transient failure

- **WHEN** a put job fails with a retryable network error
- **THEN** the engine MUST retry according to backoff policy without blocking editing

#### Scenario: Auth failure after retries

- **WHEN** puts repeatedly fail due to invalid credentials
- **THEN** the canvas sync status MUST become `error` and the UI MUST expose a subtle error state with a way to retry or open settings

### Requirement: Per-canvas single-flight

For a given canvas id, the sync engine MUST NOT run concurrent put-document jobs that could race. Newer local revisions MUST supersede older queued puts for the same canvas when practical.

#### Scenario: Rapid autosaves

- **WHEN** multiple local saves occur before the first remote put finishes
- **THEN** the engine MUST eventually upload the latest local revision without leaving permanent remote state stuck on an intermediate revision as the only outcome

### Requirement: Adapter-only remote I/O

All remote list/get/put/delete for sync MUST go through the active `CloudStorageAdapter`. The sync engine MUST NOT call S3 HTTP APIs directly.

#### Scenario: Put document

- **WHEN** a put-document job runs
- **THEN** it MUST call the adapter’s put canvas (and related meta) APIs only

### Requirement: Subtle sync status for users

The system MUST expose non-modal sync status for cloud-bound work: at least saved-locally, syncing, offline/will-sync, and sync-error. Normal successful sync MUST NOT require a dialog.

#### Scenario: Successful background sync

- **WHEN** a pending canvas finishes uploading
- **THEN** its status MUST become `synced` without interrupting the user with a modal

### Requirement: Delete via outbox

Deleting a cloud canvas MUST remove or tombstone it locally immediately and enqueue a remote delete so the object is removed from the bucket when online.

#### Scenario: Delete while offline

- **WHEN** the user deletes a canvas offline
- **THEN** it MUST disappear from the local Files list and a delete job MUST run when connectivity returns
