# Design: local-first cloud sync

## Context

`add-cloud-storage` made cloud **online-first** for bound canvases:

```text
edit → export .fig → await adapter.putCanvas (+ thumb) → done
```

That blocks the editor on network for multi‑MB files, fails hard offline, and makes S3 feel like the product rather than a silent durability layer.

We already have:

- `CloudStorageAdapter` (remote I/O only)
- Cloud binding `{ providerId, canvasId }` on the editor
- Autosave when cloud-bound
- Thumbnail extract/render + `putThumbnail`
- Files home that lists via remote `listCanvases`

Collab uses Yjs + y-indexeddb for real-time multiplayer — **different problem**. Do not reuse CRDT as the BYOK file mirror.

## Goals / Non-Goals

**Goals:**

- **Local is authoritative for the open session**: save/autosave never waits on S3.
- **Cloud is a background mirror** of cloud-bound canvases under the existing namespace.
- **Files home is instant** from a local index; remote reconcile is background.
- **Survive refresh** mid-upload via a durable outbox.
- **Subtle status only** (saved / syncing / offline / error after retries) — no modal for normal sync.
- **Zero behavior change** when cloud is not configured.
- Phased delivery: A buffer → B durable outbox → C local-first home → D multi-device conflicts.

**Non-Goals:**

- Scene-graph CRDT merge or operational transform between devices.
- Full version history product UI (optional object-level prev copies only if needed for LWW safety).
- Changing BYOK credentials model or namespace layout.
- Forcing unconfigured users into a local recents cloud-mirror.
- Real-time collab over S3.
- Multipart/resumable S3 protocol in phase A (single PUT is fine; progress may come later).

## Decisions

### 1. Local-first + outbox (not “publish” or CRDT)

**Decision:** On save, write local store + enqueue sync jobs. A background `SyncEngine` drains the outbox to `CloudStorageAdapter`.

**Alternatives rejected:**

- Keep blocking PUT (status quo) — poor UX for large figs.
- Explicit “Publish to cloud” — not invisible.
- Yjs as source of truth + snapshot to S3 — heavy, wrong conflict model for file mirror.

### 2. Storage: OPFS primary, IndexedDB for index/queue

**Decision:**

| Data | Store |
|------|--------|
| `.fig` bytes (can be tens of MB) | OPFS (web) / Tauri app data file |
| Meta, index, sync status, outbox jobs | IndexedDB (or structured OPFS JSON if simpler) |
| Thumbs | OPFS or IDB blob |

**Rationale:** IDB alone is a poor fit for 27MB+ binaries. OPFS is the browser primitive for large durable files.

**Fallback:** If OPFS unavailable, IDB blobs with clear size warnings; never `localStorage` for documents.

### 3. Per-canvas record model

```text
LocalCanvasRecord {
  id: string                 // same as cloud canvasId
  providerId: CloudProviderId
  name: string
  updatedAt: string          // ISO, local wall clock on edit
  revision: number           // monotonic local counter
  contentHash?: string       // optional sha of fig bytes
  syncStatus: 'synced' | 'pending' | 'error' | 'conflict'
  lastSyncedAt?: string
  lastSyncError?: string
  figPath / figBlobKey       // where bytes live
  thumbPath / thumbBlobKey?
}
```

Remote objects stay:

```text
open_pencil_storage/canvases/{id}.fig
open_pencil_storage/canvases/{id}.meta.json
open_pencil_storage/canvases/{id}.thumb.jpg
```

### 4. Outbox jobs (idempotent)

Job types:

- `putCanvas` — fig bytes + meta
- `putThumb` — jpeg
- `deleteCanvas` — remote delete after local tombstone

**Ordering:** per `canvasId`, single-flight: complete putCanvas before putThumb; delete cancels pending puts for that id.

**Retries:** exponential backoff; permanent auth/config errors surface after N failures; network errors stay silent with “Offline · will sync”.

### 5. Editor save path change

```text
BEFORE: buildFig → await putCanvas → await thumb → savedVersion++
AFTER:  buildFig → await localStore.write → enqueue putCanvas+putThumb → savedVersion++
        SyncEngine (async) → adapter.put*
```

`hasWritableSource` still true for cloud binding. Autosave debounce unchanged; only the write target changes.

### 6. Open path

1. If local record exists with fig bytes → load local (fast).
2. Else → `adapter.getCanvas` → seed local → open.
3. Optional: if remote meta `updatedAt` > local and local is `synced`, pull remote (phase D; phase A–C may always prefer local if pending).

### 7. Files home

1. Render from `localStore.list()` immediately.
2. Background `adapter.listCanvases()` + merge:
   - Remote-only → enqueue/fetch meta+thumb into cache (lazy fig download on open).
   - Local pending → keep local name/updatedAt; badge Syncing.
   - Remote newer + local synced → update index (and invalidate fig if needed).
3. Thumbs: local first; hydrate missing from remote `getThumbnail` or generate on open/save.

### 8. Create / import

- Allocate id, write local fig + meta + thumb, status `pending`, enqueue put.
- Card appears immediately.
- Import validation stays pre-write (fig-kiwi / pen shape).

### 9. Delete

- Tombstone local + remove from UI + enqueue `deleteCanvas`.
- Until remote delete succeeds, refresh must not resurrect from remote list (filter tombstones).

### 10. Conflict policy (phase D; document now)

**Default:** last-write-wins by comparing remote meta `updatedAt` vs local `lastSyncedAt` / local `updatedAt`.

If remote changed after `lastSyncedAt` and local is `pending`:

- Mark `conflict`.
- v1 UX: “Keep mine” (force put) / “Keep cloud” (discard local dirty) / “Keep both” (new id copy).

Optional safety: before overwriting remote, copy previous remote object to `…/{id}.prev.fig` (implementation optional).

### 11. Sync status UX

- Editor: soft chip or reuse cloud activity — **Saved**, **Syncing…**, **Offline · will sync**, **Sync failed** (retry).
- Files card: small icon when `pending` / `error` / `conflict`.
- Never block canvas interaction on sync.

### 12. Relationship to existing cloud specs

- `CloudStorageAdapter` stays the **only** remote I/O surface.
- `cloud-document-source` requirements that say “save MUST put to adapter” become “save MUST persist locally and enqueue adapter put; remote durability is eventual”.
- Unconfigured installs: no local cloud store required.

### 13. Phasing

| Phase | Deliverable |
|-------|-------------|
| **A** | Local write buffer + fire-and-forget PUT (may not survive hard refresh mid-flight) |
| **B** | Durable outbox + retries + status |
| **C** | Local-first Files home + open-from-cache |
| **D** | Multi-device pull + conflict UI |

Ship A ASAP for large-upload UX; B is the minimum “real” local-first; C is the Figma-like feel; D is multi-device.

## Risks / Trade-offs

- **[Risk] OPFS quota / Safari quirks** → Mitigation: feature-detect; IDB fallback; clear errors if write fails.
- **[Risk] Dual sources of truth during bugs** → Mitigation: single writer path (editor → local only); adapter only via SyncEngine; integration tests for enqueue/drain.
- **[Risk] Stale Files list if reconcile fails** → Mitigation: show local always; “Last synced” timestamp; manual refresh still hits remote.
- **[Risk] Large concurrent puts thrash B2** → Mitigation: global concurrency limit (e.g. 1–2 uploads); per-canvas single-flight.
- **[Risk] Conflict silent data loss** → Mitigation: don’t enable multi-device overwrite until phase D UI exists; phase A–C treat as single-device backup.
- **[Risk] Thumb generation still heavy on save** → Mitigation: generate async after local fig write; enqueue putThumb separately; never block savedVersion on thumb.

## Migration Plan

1. Existing remote-only canvases: first open or home reconcile seeds local cache.
2. No remote schema change; same object keys.
3. Feature flag or gradual: if local store init fails, fall back to current online-first path once (logged).
4. Rollback: disable SyncEngine and restore direct put in writer (feature flag).

## Open Questions

1. Phase A ship behind flag or default-on for configured cloud?
2. Should unconfigured users get a pure-local “Recents” later (out of scope here)?
3. Content-hash for skip-identical PUT (nice-to-have vs always put)?
4. Tauri: OPFS vs `plugin-fs` under app data — prefer app data for desktop durability?
5. Exact conflict UX copy and whether `.prev.fig` is required in D.
