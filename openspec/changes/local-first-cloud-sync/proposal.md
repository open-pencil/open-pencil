# Local-first cloud sync

## Why

Cloud-bound save/autosave today waits on S3 PUT (and thumbnail upload). Large `.fig` files hang the UI, offline/flaky networks feel broken, and “cloud” is always on the critical path. Users expect BYOK cloud to behave like a silent backup mirror: **local is instant and durable; the bucket catches up in the background**.

## What Changes

- Introduce a **local canvas store** (OPFS preferred, IndexedDB fallback) for cloud-bound documents: document bytes, meta, thumb, sync state, revision.
- Introduce a durable **sync outbox** + background **sync engine** that pushes dirty canvases to the existing `CloudStorageAdapter` without blocking the editor.
- Change cloud **save / autosave** so the success path is **local write + enqueue**, not “wait for remote PUT”.
- Change **Files home** to paint from the **local index first**, then reconcile with remote `listCanvases` in the background.
- Change **open** to prefer local cache when present; otherwise download once and seed the cache.
- Add subtle, non-modal sync status (saved / syncing / offline / error after retries).
- Define a simple **multi-device / conflict** policy for later phases (last-write-wins + optional keep-both); Phase A–C may be single-device-first.
- When cloud is **not** configured, keep **zero behavior change** (no local cloud mirror required).

## Capabilities

### New Capabilities

- `local-canvas-store`: Durable per-canvas local cache (document, meta, thumb, revision, sync status) and canvases index for Files home.
- `cloud-sync-engine`: Outbox queue, background worker, retry/backoff, online/offline handling, silent push/pull reconcile against the active cloud adapter.

### Modified Capabilities

- `cloud-document-source`: Save/autosave become local-first for cloud bindings; remote write is async via the sync engine. Open prefers local cache then remote.
- `cloud-project-home`: List/create/import paint from local index immediately; remote list is background reconcile. Cards show local thumbs and sync badges when needed.
- `cloud-storage`: Adapter remains the remote API; no change to credentials/namespace layout, but put/get are driven by the sync engine rather than the editor critical path.

## Impact

- **App**: New `src/app/cloud/local-store/**`, `src/app/cloud/sync/**`; changes to `src/app/document/io/**`, `src/app/cloud/home/**`, `src/app/tabs/**`, Files home UI status.
- **Depends on**: Existing `CloudStorageAdapter`, cloud binding `{ providerId, canvasId }`, thumbnail pipeline.
- **Storage**: Browser OPFS (primary for multi‑MB `.fig`) + IndexedDB for index/queue metadata; Tauri may use app data dir.
- **Product**: Still opt-in BYOK; still no app accounts. Cloud becomes an invisible durability layer when configured.
- **Not in first implementation phases**: Full CRDT merge of scene graphs, version history UI, multi-provider simultaneous sync, encryption of the local cache.
