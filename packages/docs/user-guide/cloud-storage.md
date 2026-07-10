---
title: Cloud storage (S3)
description: Optional user-owned S3-compatible storage and browser CORS setup for OpenPencil.
---

# Cloud storage (S3)

OpenPencil can store canvases in **your** S3-compatible bucket (AWS S3, Backblaze B2, Cloudflare R2, MinIO, and similar). This is opt-in: with no credentials, the app stays fully local.

Files live under a fixed namespace so you can share a bucket with other tools:

```text
open_pencil_storage/
  .openpencil-namespace
  canvases/{id}.fig
  canvases/{id}.meta.json
```

## Web app first (recommended path)

Do this in the **browser** build of OpenPencil.

### 1. Create a bucket + application key (provider console)

In Backblaze B2 / AWS / R2:

1. Create a **private** bucket (or reuse one).
2. Create an **application key** with read/write on that bucket (B2: not the master key for S3).
3. Note **endpoint**, **region**, **bucket name**, **key ID**, **secret**.

### 2. Enter credentials and test (auto CORS)

1. Open OpenPencil → **Settings** (top right) → **Cloud storage** tab.
2. Fill **Endpoint**, **Region**, **Bucket**, **Access key ID**, **Secret**.
3. Click **Test connection** (it auto-applies CORS where permissions allow).

The app runs the same **PutBucketCors** operation as the AWS CLI:

- **Desktop app:** almost always applies CORS automatically for web origins.
- **Web app:** tries automatically; if the browser is blocked (bucket has no CORS yet), you get a clear **CORS issue** alert.

**If the web app shows a CORS alert:**

1. Click **Copy CORS JSON (manual fallback)** in the alert or settings.
2. Paste into the bucket CORS settings (B2 simple radio options are not enough — use CLI or a host that accepts S3 CORS JSON; or use desktop Test connection once).
3. Wait ~1 minute, then Test connection again.

### 3. After success

Reload: you should get the **Files** home.

Example Backblaze fields:

- Endpoint: `https://s3.us-west-004.backblazeb2.com` (use your region)
- Region: `us-west-004`
- Bucket: your bucket name
- Access key ID / secret: application keyID / applicationKey

## Desktop (optional later)

|         | Web browser                               | Desktop (Tauri)                        |
| ------- | ----------------------------------------- | -------------------------------------- |
| Network | Browser `fetch` (**CORS required**)       | App HTTP bridge (no browser CORS)      |
| Setup   | Copy CORS JSON once, then Test connection | Test connection can apply CORS for web |

## Browser CORS details

Signed S3 requests send `Authorization` and `x-amz-*` headers, so the browser always runs a CORS preflight. Your bucket must allow OpenPencil’s origin.

### Quick path: copy from the app

In **Cloud storage** settings, click **Copy CORS JSON for bucket**, then paste it into your provider’s CORS editor (AWS S3 console → Permissions → CORS; B2 → Bucket Settings → CORS / S3 API).

The JSON includes at least:

- `https://app.openpencil.dev`
- `http://localhost:1420` and `http://127.0.0.1:1420` (desktop/web dev)
- The current page origin when you copy from the browser

Methods: `GET`, `PUT`, `POST`, `DELETE`, `HEAD`  
Headers: `*`  
Expose: `ETag`, `x-amz-request-id`, `x-amz-id-2`, `x-amz-version-id`

### AWS CLI example

```bash
# cors.json is the file from “Copy CORS JSON for bucket”
aws s3api put-bucket-cors \
  --bucket YOUR_BUCKET \
  --cors-configuration file://cors.json \
  --endpoint-url https://s3.YOUR_REGION.backblazeb2.com
```

### Backblaze B2 notes

- Use an **application key** that can use the S3-compatible API (not only the master key).
- Prefer the **S3-compatible** CORS API / “Copy CORS JSON” document above.
- Endpoint form: `https://s3.<region>.backblazeb2.com`.

If Test connection in the browser fails with a network/CORS message, apply CORS from the desktop app or paste the JSON, then retry.

## Security

- Keys stay in **localStorage** on this device (same pattern as AI API keys). localStorage is readable by any script running on this origin — treat it as convenience storage, not a secure vault. Do not commit keys.
- Prefer a key scoped to one bucket with read/write only.
- Desktop does not need public buckets; objects stay private with signed requests.
