---
title: Cloud Storage
description: Sync documents to your own S3-compatible bucket, Backblaze B2, Bunny Storage, or Appwrite — local-first, with an honest sync status.
---

# Cloud Storage

OpenPencil is local-first: every document lives on your device, and cloud storage is a replication destination, not a requirement. Connect your own bucket and documents sync in the background; keep working offline and changes upload when you are back.

## Connecting a provider

Open **Settings → Storage** and choose a provider:

- **Appwrite** — Appwrite Cloud or self-hosted, using a storage bucket.
- **Backblaze B2** — via its S3-compatible API, with a dedicated configuration.
- **Bunny Storage** — via Bunny's S3-compatible endpoint (currently a beta/preview feature on Bunny's side). Bunny's regular Storage HTTP API is a different protocol and is not supported.
- **Generic S3** — any S3-compatible endpoint (AWS S3, Cloudflare R2, MinIO, …).

Credentials are stored in the native system credential store on desktop, or WebCrypto-encrypted browser storage — never in plain preferences.

## How sync works

- **Local first.** Saves commit to the device immediately; uploads drain from a durable outbox in the background. Closing the app mid-upload loses nothing — the queue resumes on the next start.
- **What is uploaded.** The document body (`.fig`), a small metadata sidecar (name, dates, trash state), and a thumbnail.
- **Pausing.** The backup switch stops all remote writes without discarding anything; queued work resumes when you switch it back on.
- **Trash and delete.** Trashing syncs the trash state; deleting permanently removes the remote objects. Disconnecting a destination never deletes anything remotely.

## The sync status chip

The workspace and editor show a small status chip:

| Indicator | Meaning |
|-----------|---------|
| Cloud check | The destination is reachable. Reachable is not "everything is backed up" — a number badge shows queued changes. |
| Spinner | Uploading now. |
| Orange | Degraded — offline or the destination is unreachable; changes queue locally. |
| Red | Sync is paused and needs attention — click for the exact document and cause. |

## Conflicts between devices

Writes are last-write-wins on every currently supported provider: none of them offers the conditional writes needed to *prevent* two devices from overwriting each other. Editing the same document on two devices at once can overwrite the older change. Conflict detection (notice an overwrite and offer recovery) is on the roadmap — see `development/roadmap.md`.

## Provider capability matrix

What each provider offers the sync layer. Response-side behavior matters as much as request-side: a provider that lets a browser cache a mutable object can serve the wrong content, so all storage reads bypass the browser HTTP cache.

| Capability | AWS S3 (reference) | B2 (S3 API) | Bunny (S3 mode) | Appwrite |
|---|---|---|---|---|
| Object user metadata (`x-amz-meta-*`) | yes (2 KB) | yes — `fileInfo`, 7 KB header budget | no | no (metadata in Appwrite DB) |
| Conditional PUT (`If-Match` / `If-None-Match`) | yes | not documented | explicitly unsupported | no |
| Multipart / chunked upload | yes | yes | yes (≤10,000 parts; 10-day sessions) | yes (5 MB chunks) |
| ETag on `HeadObject` | yes | yes | no | n/a |
| Same-key writes within one second | ordered | **may be processed out of order** | ordered | n/a (immutable files) |
| `Cache-Control` on read responses | none by default | none observed | none observed | `private, max-age=3888000` (45 days) — bypassed via `cache: 'no-store'` |
| File versions retained | optional | yes, by default | no | n/a |

Notes:

- **Backblaze B2 same-second writes.** B2 documents that multiple writes to one key within the same second may be processed out of order. OpenPencil's sync engine never issues two different payloads to one key in quick succession — body uploads write metadata read at completion — so this does not affect normal use.
- **Bunny maturity.** Bunny's S3 compatibility is described as public preview on one vendor page and beta on another; treat it as preview software.
