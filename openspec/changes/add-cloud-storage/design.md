# Design: optional user-owned cloud storage + project home

## Context

Today OpenPencil is **local-first**:

- Launch → blank Untitled editor (`EditorView` at `/`).
- Open/save via OS pickers (Tauri path or browser File System Access).
- Document source state tracks only `filePath` | `FileSystemFileHandle` | download name.
- Secrets for AI / stock photos live in Provider Settings via `useLocalStorage` (`open-pencil:`).

There is no project browser, no remote document store, and roadmap historically lists “cloud-first storage or mandatory accounts” as a non-goal. This design adds **opt-in BYOK S3-compatible storage** only — user-owned buckets, no app accounts.

First smoke target: **Backblaze B2** S3-compatible API. Architecture must not hardcode B2; other S3 hosts and future non-S3 backends (Drive, …) plug in via adapters.

## Goals / Non-Goals

**Goals:**

- Dual mode: no credentials → zero UX change; credentials present → Figma-like files home + cloud as source of truth for those canvases.
- Shared-bucket safe: all objects under fixed namespace `open_pencil_storage/`.
- Adapter interface so Home + document I/O never call S3 APIs directly.
- Cloud document binding with Save + autosave.
- Clean PR branch off current `master` (`feat/cloud-storage`).

**Non-Goals:**

- App-operated backend, accounts, billing, teams, permissions.
- Folder/project hierarchy (flat canvas list in v1).
- Version history / branching.
- OS keychain encryption of secrets.
- Implementing Google Drive / Dropbox in v1 (interface only).
- Multi-provider simultaneous bindings (one active cloud provider).

## Decisions

### 1. Adapter interface over hard-coded S3

**Decision:** `CloudStorageAdapter` with `testConnection`, `ensureNamespace`, `listCanvases`, `getCanvas`, `putCanvas`, `deleteCanvas` (+ optional thumbnail). Registry maps `CloudProviderId` → factory. Home and document I/O use `getActiveCloudAdapter()` only.

**Alternatives:** Direct S3 client calls from UI (rejected: locks product to S3). Full AWS SDK (rejected: bundle size / Node bias).

### 2. S3-compatible as the only v1 adapter

**Decision:** One `S3CompatibleAdapter` configured by endpoint + region + bucket + accessKeyId + secretAccessKey. UI presets (B2 / AWS / R2 / Custom) may prefill endpoint hints but share the same code path.

**Rationale:** Covers B2 and most self-host setups without per-vendor forks.

### 3. Fixed namespace in a shared bucket

**Decision:** Prefix `open_pencil_storage/`:

```text
open_pencil_storage/.openpencil-namespace   # marker on first connect
open_pencil_storage/canvases/{uuid}.fig
open_pencil_storage/canvases/{uuid}.meta.json
open_pencil_storage/canvases/{uuid}.thumb.jpg   # optional
```

Never list without this prefix. Marker put on first Test / home load.

**Alternatives:** Dedicated empty bucket (rejected: users share buckets). User-editable prefix in v1 (deferred to advanced settings).

### 4. Credentials in Provider Settings + localStorage

**Decision:** New **Cloud storage** section beside stock/AI keys. Same draft/save UX (secrets not re-shown after save). Storage keys under `open-pencil:cloud:`.

**Rationale:** Existing pattern; no new settings surface. Later adapters add fields via provider picker.

### 5. Dual-mode routing

**Decision:**

| Configured? | `/` | Editor |
|---|---|---|
| No | Redirect to `/edit` (or equivalent blank editor path) | Blank Untitled as today |
| Yes | `HomeView` canvas grid | `/edit` or `/edit/cloud/:canvasId` |

File association / MCP open bypass home and open the editor directly.

### 6. Document binding `{ providerId, canvasId }`

**Decision:** Extend document source state with optional cloud binding (mutually exclusive with path/handle). `hasWritableSource` true when bound. Autosave default **on** for cloud docs. Save uses `adapter.putCanvas`.

**Rationale:** Stable UUID identity; rename only updates meta, not object key.

### 7. HTTP transport

**Decision:** Sign with `aws4fetch` (`client.sign`), then `cloudFetch` → Tauri `proxy_http_request` on desktop, browser `fetch` otherwise. Path-style URLs: `{endpoint}/{bucket}/{key}`.

**Rationale:** Desktop avoids CORS; browser needs user-configured bucket CORS (documented).

### 8. SigV4 library

**Decision:** `aws4fetch` over full `@aws-sdk/client-s3`.

## Architecture

```text
HomeView / document I/O / autosave
            │
            ▼
   CloudStorageAdapter (interface)
            │
   ┌────────┴────────┐
   ▼                 ▼
S3CompatibleAdapter  (future adapters)
   │
   SigV4 + cloudFetch
   namespace helpers
```

### Module layout (app)

| Path | Role |
|---|---|
| `src/app/cloud/types.ts` | Adapter + config types |
| `src/app/cloud/namespace.ts` | Fixed prefix helpers |
| `src/app/cloud/credentials.ts` | `useLocalStorage` + `isCloudConfigured` |
| `src/app/cloud/registry.ts` / `active.ts` | Provider registry + active adapter |
| `src/app/cloud/s3/*` | Client + adapter |
| `src/app/cloud/home/use.ts` | List/rename/delete orchestration |
| Provider Settings `CloudStorageSection.vue` | Credentials UI |
| `HomeView.vue` + router | Project home |
| `document/io/*` | Cloud binding in source/write/save |

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Browser CORS blocks S3 | Document CORS rules; desktop uses Tauri HTTP; clear error + link to settings |
| Secrets in localStorage | Same as AI keys; document risk; never commit keys |
| N+1 meta fetches on list | Parallel `Promise.all`; later embed name in listing strategy |
| Last-write-wins conflicts | Accept for v1; optional ETag later |
| Roadmap “non-goal” conflict | Rephrase: no mandatory accounts; BYOK allowed |
| `/` redirect breaks old bookmarks | Unconfigured still lands in editor; tests that hit `/` still get editor |

## Migration Plan

1. Ship on `feat/cloud-storage` from current `master`.
2. Default: no credentials → identical UX.
3. Users opt in by filling Cloud storage settings.
4. Rollback: remove feature flag not required — disable by clearing credentials or revert branch.

## Open Questions

- Exact home visual density once Figma screenshots are provided (layout polish only).
- Whether File → New creates a cloud canvas when configured (recommended: yes in a follow-up).
- Trash vs hard delete (v1: hard delete).
- Optional user-overridable namespace prefix (advanced).
