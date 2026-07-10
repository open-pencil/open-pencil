# Tasks: local-first-cloud-sync

## 1. Local canvas store foundation

- [x] 1.1 Add `src/app/cloud/local-store/` types: `LocalCanvasRecord`, sync status union, index entry
- [x] 1.2 Implement OPFS-backed document blob storage with IDB/app-data fallback for meta + index
- [x] 1.3 Implement `writeCanvas`, `readCanvas`, `listCanvases`, `deleteCanvas` / tombstone APIs
- [x] 1.4 Unit tests for write/read/list and “no localStorage for fig bodies”

## 2. Sync engine + outbox (Phase B core)

- [x] 2.1 Add durable outbox (IDB) for `putCanvas`, `putThumb`, `deleteCanvas` jobs
- [x] 2.2 Implement `SyncEngine`: online/offline, backoff, per-canvas single-flight, concurrency limit
- [x] 2.3 Wire jobs to active `CloudStorageAdapter` only (no direct S3)
- [x] 2.4 On success: mark record `synced` + `lastSyncedAt`; on permanent failure: `error`
- [x] 2.5 Unit tests for enqueue, supersede older puts, resume after reload (mock adapter)

## 3. Document I/O local-first (Phase A+B)

- [x] 3.1 Change cloud `writeFile` path: local store write + enqueue; do not await remote PUT for save success
- [x] 3.2 Keep autosave debounce; point it at the local-first writer
- [x] 3.3 Enqueue thumbnail generation async after local save (still regenerate on each save)
- [x] 3.4 Open cloud canvas: local hit first; remote get + seed on miss
- [x] 3.5 Create / import: local write + pending + enqueue; then navigate/open as today
- [x] 3.6 Engine tests for “offline save succeeds” and “open from local without network”

## 4. Files home local-first (Phase C)

- [x] 4.1 `useCloudHome.refresh`: paint from local index immediately
- [x] 4.2 Background `listCanvases` reconcile + merge rules (remote-only, pending local, tombstones)
- [x] 4.3 Card thumbs from local cache first; remote hydrate as today
- [x] 4.4 Subtle pending/error/conflict affordances on cards + non-modal editor sync status
- [x] 4.5 i18n strings for sync states (Saved / Syncing / Offline · will sync / Sync failed)

## 5. Delete + lifecycle

- [x] 5.1 Delete: tombstone local, remove from UI, enqueue remote delete
- [x] 5.2 Reconcile must not resurrect tombstoned ids until remote delete confirmed
- [x] 5.3 Clear/orphan cleanup when user clears cloud credentials (document behavior)

## 6. Multi-device conflicts (Phase D — after A–C)

- [ ] 6.1 Detect remote newer than `lastSyncedAt` while local `pending` → `conflict`
- [ ] 6.2 UI: Keep mine / Keep cloud / Keep both (new id)
- [ ] 6.3 Optional: write `…prev.fig` before force overwrite

## 7. Hardening & docs

- [x] 7.1 Feature flag or safe fallback if OPFS/local store init fails (log + temporary online-first)
- [ ] 7.2 Manual QA: large fig import, offline edit, reload mid-upload, multi-tab single-flight
- [x] 7.3 CHANGELOG Unreleased note; update AGENTS/docs only if architecture surface changes
- [ ] 7.4 Archive or cross-link relationship to `add-cloud-storage` change when shipping
