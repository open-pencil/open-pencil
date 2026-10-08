---
title: Cloud Storage
description: Keep documents and component libraries in your own S3-compatible bucket — AWS S3, Backblaze B2, Cloudflare R2, MinIO, and others.
---

# Cloud Storage

OpenPencil can keep documents in a bucket you own on any S3-compatible service: AWS S3, Backblaze B2, Cloudflare R2, MinIO, and others. There is no OpenPencil server in between; the editor talks to your bucket directly with your own access keys.

## Connect a Bucket

Open **Settings → Cloud storage**, select **S3 storage**, and fill in:

| Field                 | What to enter                                                                     |
| --------------------- | --------------------------------------------------------------------------------- |
| **Endpoint**          | The provider's S3 API URL, including any required path. See the examples below.  |
| **Bucket**            | The bucket name.                                                                  |
| **Region**            | Optional. Left empty, it is read from the endpoint, or `us-east-1` when it can't be. |
| **Access key ID**     | An access key with read, write, list, and delete access to the bucket.            |
| **Secret access key** | The key's secret.                                                                 |

Endpoint examples:

- AWS S3: `https://s3.eu-west-1.amazonaws.com`
- Backblaze B2: `https://s3.eu-central-003.backblazeb2.com`
- Cloudflare R2: `https://<account-id>.r2.cloudflarestorage.com`
- MinIO: `http://localhost:9000`, or wherever your server listens

Select **Test connection** to check the endpoint, keys, and bucket before saving, then **Save**. OpenPencil addresses objects as `{endpoint}/{bucket}/{key}`, so the bucket name never goes into the endpoint.

Access keys are kept in the system credential store in the desktop app. In the browser they are encrypted in browser storage, or kept only until you close the session when **Settings → General → Remember API keys on this device** is off.

## Allow the Web App in CORS

The browser can only reach a bucket that allows requests from the page's origin, so the web app needs a CORS rule on the bucket. The desktop app sends its requests natively and needs none.

Add a rule like this one, with the origins you open OpenPencil from:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["https://app.openpencil.dev"],
    "ExposeHeaders": ["ETag", "Content-Range", "x-amz-request-id", "x-amz-id-2", "x-amz-version-id"],
    "MaxAgeSeconds": 3600
  }
]
```

Set it in the AWS console under the bucket's **Permissions → Cross-origin resource sharing**, in the Cloudflare dashboard under the R2 bucket's **Settings → CORS policy**, or with your provider's CLI. When the rule is missing, **Test connection** says the browser could not reach the bucket from the current site.

## Save a Document to Storage

Open or create a document, then choose **File → Save to storage…**. The document is saved into the bucket and the tab stays bound to it: **Save** and auto-save now write to storage instead of a local file. A local `.fig` you had open keeps its last saved contents.

To open stored documents, choose **File → Open storage workspace…**. The workspace lists every document in the bucket with a preview read from the document itself, so listing a large file downloads only its embedded thumbnail.

## How Saving Works

Saving writes the document on this device first and uploads it in the background, so editing never waits for the network. If an upload fails or you are offline, it is retried with increasing delays, and pending work resumes when you reconnect or change storage settings.

Each document is uploaded whole. When two devices save the same document, the last upload wins.

Documents you have opened stay cached on the device for faster reopening, up to 500 MB. Only copies that are fully uploaded are removed when the cache is full, and they are downloaded again the next time you open them.

## Component Libraries

The bucket can also hold component libraries. In **Assets → Manage libraries**, switch the source to **Storage** to publish and enable libraries there instead of on this device. Publishing uses conditional writes, so two people publishing the same library at once can't overwrite each other's revision. See [Components](./components#component-libraries) for publishing and updating libraries.

## What's in the Bucket

OpenPencil writes only under two prefixes and leaves everything else in the bucket alone:

- `open_pencil_storage/canvases/` — each document as `<id>.fig`, with its name and modification time in `<id>.meta.json`.
- `open-pencil/libraries/` — each library's `manifest.json` and its published revisions.

## Provider Notes

- **Cloudflare R2** needs the exact web app origin in its CORS rule; it does not accept wildcard origins such as `https://*.example.com`.
- **MinIO** answers CORS requests from any origin unless you configure otherwise.
- **`rclone serve s3`** works with two limits. It rejects CORS preflight requests, so the web app needs a reverse proxy in front of it that answers them; the desktop app does not. It also ignores conditional writes, so concurrent library publishes are not detected.
