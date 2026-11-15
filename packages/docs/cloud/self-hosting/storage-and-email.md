---
title: Cloud Storage and Email
description: Configure the S3-compatible bucket, deleted-file retention, and email delivery for a self-hosted OpenPencil Cloud server.
---

# Storage and Email

## Storage

Any S3-compatible store works; the project tests against SeaweedFS and Garage. Keep `object_storage.checksum_verification = "metadata"` for stores without native SHA-256 checksums: OpenPencil stores each document's digest as object metadata and verifies it before committing a revision. For Garage, set `region = "garage"` and `force_path_style = true`, and leave server-side encryption unset. For Cloudflare R2, use the endpoint `https://<account ID>.r2.cloudflarestorage.com` with `region = "auto"` and `force_path_style = false`. Cleanup deletes files no document holds any more, so a database restored to an earlier time can name files that are gone. On a bucket with versioning, restore their last versions; on one without, such as R2, set `object_storage.deleted_prefix = "deleted/"` to keep each deleted file under that prefix, and add a lifecycle rule that expires the prefix after longer than the database's restore window. After a restore, and before the server serves again, copy `deleted/<key>` back to `<key>` for each file the bucket lacks that a revision, an image, or a room snapshot in the restored database refers to, by its `storage_object` row's `object_key`. Other `storage_object` rows can name files never written, such as a snapshot whose upload failed, and need nothing.

Revision keys are immutable, so bucket versioning isn't needed, but it isn't a backup either. Size `[workers.cleanup]` for your upload volume and retention, or set `enabled = false` and run `cleanup` from a scheduler. `[documents] retention_days` (30 by default) is how long a deleted document waits in Trash, where people can restore it, before cleanup destroys it. `purge_grace_days` (7 by default) is how long a document someone deletes forever, or one in a workspace an account's deletion left empty, keeps its files and rows, out of everyone's sight and off the workspace's storage, so a server administrator can restore it from **Documents** in the console (filter **Deleted forever**); cleanup destroys it after that, and `0` destroys it at once.

## Email

Set `email.transport = "smtp"` with an `[email.smtp]` table, `"cloudflare"` on Cloudflare Workers to send through Cloudflare Email Service from an address on a domain onboarded to it (the Worker needs the `send_email` binding named `EMAIL`, and sending to addresses you haven't verified needs Workers Paid), or `"none"` to send nothing; invitations still work through their links. Messages go through an encrypted outbox in PostgreSQL, tuned under `[workers.email]`. Delivery records that the SMTP server accepted a message, not that it reached the inbox.
