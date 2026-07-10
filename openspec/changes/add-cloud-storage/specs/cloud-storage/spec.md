# Spec: cloud-storage

## ADDED Requirements

### Requirement: Pluggable cloud storage adapter

The system SHALL access remote canvas storage only through a `CloudStorageAdapter` interface that exposes connection test, namespace ensure, list, get, put, and delete operations for canvases.

#### Scenario: Home and document I/O never call S3 APIs directly

- **WHEN** the app lists, opens, saves, or deletes a cloud canvas
- **THEN** those operations MUST go through the active adapter obtained from the registry, not through low-level S3 client imports in UI or document I/O modules

#### Scenario: Registry supports S3-compatible provider in v1

- **WHEN** the active cloud provider id is `s3-compatible`
- **THEN** the system MUST construct an adapter that talks to any S3-compatible endpoint using the stored endpoint, region, bucket, access key id, and secret access key

### Requirement: User-configurable S3-compatible credentials

The system SHALL allow the user to store S3-compatible credentials (endpoint, region, bucket, access key ID, secret access key) in local app storage, and SHALL consider cloud storage configured only when all of those fields are non-empty.

#### Scenario: Incomplete credentials are not configured

- **WHEN** any of endpoint, region, bucket, access key ID, or secret access key is empty
- **THEN** `isCloudConfigured` MUST be false and cloud home MUST NOT activate

#### Scenario: Secrets are not re-displayed after save

- **WHEN** the user has saved a secret access key and reopens cloud storage settings
- **THEN** the secret field MUST NOT show the stored value in cleartext and MUST indicate that a key is already saved

#### Scenario: User can clear credentials

- **WHEN** the user clears cloud storage credentials
- **THEN** all stored S3 fields MUST be removed and cloud storage MUST become unconfigured

### Requirement: Shared-bucket namespace isolation

The system SHALL store all OpenPencil cloud objects under the fixed prefix `open_pencil_storage/` and MUST NOT list or mutate objects outside that prefix.

#### Scenario: Namespace marker created on first use

- **WHEN** the user tests the connection or loads the cloud home for the first time with valid credentials
- **THEN** the system MUST ensure a namespace marker object exists at `open_pencil_storage/.openpencil-namespace` (create if missing)

#### Scenario: Canvas objects use UUID keys under canvases/

- **WHEN** a canvas is created or saved
- **THEN** the `.fig` object key MUST be `open_pencil_storage/canvases/{uuid}.fig` and metadata MUST live at `open_pencil_storage/canvases/{uuid}.meta.json`

#### Scenario: List ignores foreign bucket keys

- **WHEN** listing canvases
- **THEN** the list request MUST use the OpenPencil canvases prefix and keys that are not canvas `.fig` objects under that prefix MUST NOT appear as canvases

### Requirement: Connection test

The system SHALL provide a connection test that validates credentials can write the namespace and list the canvases prefix.

#### Scenario: Successful connection test

- **WHEN** the user runs Test connection with valid complete credentials
- **THEN** the system MUST ensure the namespace and list under the canvases prefix, then show a success state

#### Scenario: Failed connection test surfaces an error

- **WHEN** the connection test fails (auth, network, permissions, or CORS)
- **THEN** the system MUST show an error message and MUST NOT mark the connection as successful

### Requirement: Credentials UI in Provider Settings

The system SHALL expose cloud storage configuration in the AI Provider Settings popover under a section titled for cloud storage (S3-compatible), including a provider picker structured for future non-S3 adapters.

#### Scenario: Cloud section is visible next to other API key settings

- **WHEN** the user opens Provider Settings
- **THEN** they MUST be able to configure cloud storage without leaving the settings popover
