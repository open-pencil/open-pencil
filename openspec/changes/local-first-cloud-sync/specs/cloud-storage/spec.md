# Spec: cloud-storage (delta)

## ADDED Requirements

### Requirement: Adapter remains remote-only interface

The `CloudStorageAdapter` SHALL remain the sole abstraction for remote bucket operations used by the sync engine and any residual direct calls. Local caching and outbox semantics MUST live outside the adapter implementation.

#### Scenario: S3 adapter unaware of outbox

- **WHEN** the S3-compatible adapter puts or gets a canvas
- **THEN** it MUST perform only the remote request and MUST NOT implement local durable caching itself

### Requirement: Existing namespace and object layout unchanged

Local-first sync MUST continue to use the existing OpenPencil namespace and canvas object keys (`.fig`, `.meta.json`, `.thumb.jpg`) so already-uploaded canvases remain readable.

#### Scenario: Sync put uses same keys

- **WHEN** the sync engine uploads a canvas
- **THEN** remote keys MUST match the existing `open_pencil_storage/canvases/{id}.*` layout
