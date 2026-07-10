# Add optional user-owned cloud storage + project home

## Why

OpenPencil is local-first: every launch opens a blank Untitled canvas with only OS file open/save. Users who want durable, multi-device storage must manage files themselves. We need **opt-in, BYOK, S3-compatible cloud storage** and a **Figma-like files home** when configured — without mandatory accounts or vendor cloud, and without changing unconfigured installs.

## What Changes

- Add a **storage adapter** architecture so backends are pluggable; v1 ships **S3-compatible** only (AWS, Backblaze B2, Cloudflare R2, MinIO, etc.).
- Add **Cloud storage** credentials UI in Provider Settings (endpoint, region, bucket, access key ID, secret).
- Scope all app objects to a fixed shared-bucket namespace: `open_pencil_storage/` (create marker on first use; never list/mutate the rest of the bucket).
- When cloud is configured, show a **flat canvas home** (list / create / open / rename / delete) instead of jumping straight into a blank editor.
- When cloud is **not** configured, keep **zero behavior change** (blank editor startup, local open/save only).
- Bind open cloud canvases as a first-class document source: Save and autosave write `.fig` (+ meta) through the active adapter.
- Optional local open remains available from the home screen as a secondary path.

## Capabilities

### New Capabilities

- `cloud-storage`: Adapter interface, S3-compatible implementation, credentials storage, namespace layout, connection test.
- `cloud-project-home`: Startup routing and Figma-like flat canvas browser when cloud is configured.
- `cloud-document-source`: Editor document I/O binding to cloud canvas identity (open/create/save/autosave).

### Modified Capabilities

- _(none — no existing OpenSpec capabilities yet)_

## Impact

- **App**: `src/app/cloud/**`, document I/O (`src/app/document/io/**`), tabs, router, `EditorView` / new `HomeView`, Provider Settings UI.
- **i18n**: New dialogs strings across locales.
- **Deps**: Lightweight SigV4 client (`aws4fetch`); desktop requests via existing Tauri HTTP bridge to avoid CORS.
- **Product stance**: Roadmap non-goal remains *mandatory accounts / vendor cloud*; user-owned S3 is opt-in.
- **Security**: Secrets in localStorage (same pattern as AI keys); never commit real keys; browser needs user-bucket CORS.
- **Not in v1**: Non-S3 adapters (Drive, …), teams/folders, version history, encryption of secrets in OS keychain.
