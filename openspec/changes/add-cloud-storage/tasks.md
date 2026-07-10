# Tasks: add-cloud-storage

## 1. Branch and dependencies

- [x] 1.1 Create `feat/cloud-storage` from current `origin/master` (do not stack on unrelated feature branches)
- [x] 1.2 Add lightweight SigV4 dependency (`aws4fetch`) for S3-compatible signing

## 2. Cloud storage adapter (`cloud-storage`)

- [x] 2.1 Add `src/app/cloud/types.ts` with `CloudStorageAdapter`, provider ids, configs, `CloudCanvas` / meta types
- [x] 2.2 Add fixed namespace helpers (`open_pencil_storage/`, marker, canvas key builders, id parse)
- [x] 2.3 Add credentials `useLocalStorage` + `isCloudConfigured` under `open-pencil:cloud:`
- [x] 2.4 Implement S3 path-style client: sign via aws4fetch, fetch via Tauri bridge or browser
- [x] 2.5 Implement `S3CompatibleAdapter` (ensureNamespace, testConnection, list/get/put/delete)
- [x] 2.6 Add registry + `getActiveCloudAdapter` / `requireActiveCloudAdapter`
- [x] 2.7 Unit tests for namespace keys and ListObjectsV2 XML parsing

## 3. Credentials UI (`cloud-storage`)

- [x] 3.1 Add `CloudStorageSection.vue` (provider picker, endpoint/region/bucket/keys, test connection, clear)
- [x] 3.2 Wire section into Provider Settings popover; save on Done / dismiss
- [x] 3.3 Add i18n defaults + locale keys for cloud storage and home strings

## 4. Document I/O (`cloud-document-source`)

- [x] 4.1 Extend document source state with `{ providerId, canvasId }` cloud binding
- [x] 4.2 Writer/save: cloud-bound puts via adapter; Save As local clears binding
- [x] 4.3 `hasWritableSource` includes cloud; default autosave on when setCloudDocumentSource
- [x] 4.4 Expose `setCloudDocumentSource` / `getCloudBinding` on editor store modules
- [x] 4.5 `openCloudCanvasInTab` / `createCloudCanvasInTab` using adapter + existing fig pipeline

## 5. Project home + routing (`cloud-project-home`)

- [x] 5.1 Router: `/` → home when configured else `/edit`; `/edit/cloud/:canvasId` for cloud open
- [x] 5.2 `HomeView` grid: list, empty, error, new, open, rename, delete, open local
- [x] 5.3 `useCloudHome` orchestration for list/rename/delete
- [x] 5.4 Editor “Back to files” when cloud configured; load cloud canvas from route param

## 6. Docs and product stance

- [x] 6.1 CHANGELOG Unreleased note for optional S3 cloud storage + home
- [x] 6.2 Roadmap: clarify non-goal is mandatory accounts; BYOK S3 allowed

## 7. Hardening and polish (remaining)

- [x] 7.1 User-guide note: bucket CORS for browser; B2/AWS field mapping; namespace behavior (+ PutBucketCors from desktop, copy CORS JSON in settings)
- [x] 7.2 Thumbnail generate/upload on save + show on home cards (local-first + extract/render)
- [ ] 7.3 E2E smoke with mocked adapter (configured home empty state; unconfigured still editor)
- [ ] 7.4 Manual smoke against Backblaze B2 (bucket + endpoint) and one other S3 host if available
- [x] 7.5 File → New / new-tab when configured creates cloud canvas (`createNewDocument`)
- [ ] 7.6 Run full quality gate (`bun run check`, unit tests) and open PR to `origin/master`
