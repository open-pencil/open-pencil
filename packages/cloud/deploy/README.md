# OpenPencil Cloud reference deployment

This profile runs OpenPencil Cloud with PostgreSQL 17 and a SeaweedFS S3-compatible object store. It is intended as a self-hosting reference and local integration environment.

## Start

```sh
cd packages/cloud/deploy
cp .env.example .env
# Replace BETTER_AUTH_SECRET and storage/database credentials before exposing the service.
docker compose up -d --build
docker compose ps
curl --fail http://localhost:8787/ready
```

The Cloud API is available at `http://localhost:8787`. PostgreSQL and SeaweedFS are also published on ports `54329`, `8333`, and `9333` for local inspection and smoke tests.

The Cloud container runs database migrations before accepting requests. Named volumes preserve PostgreSQL and SeaweedFS data across restarts.

## Object-store smoke test

From the repository root:

```sh
bun --filter @open-pencil/cloud test:e2e
```

The test runner creates an isolated Compose project and removes its containers and volumes when finished. It verifies object-store readiness, a presigned single PUT, and a 33 MiB, three-part presigned upload, including ordered ETags, completion, metadata SHA-256, object size, verified GET bytes, and deletion. It then exercises the complete Cloud API revision flow against real PostgreSQL and SeaweedFS, including migrations, idempotent commits, stale-base conflicts, multipart cleanup, usage, and soft deletion.

## Stop

```sh
docker compose down
```

Add `--volumes` only when you intentionally want to remove all persisted Cloud data.

## Production notes

- Put the Cloud API and S3 endpoint behind TLS with stable public hostnames.
- Change every development credential in `.env` and in `seaweedfs/s3.json`; both locations must agree.
- Configure `OPENPENCIL_CLOUD_URL` and `OPENPENCIL_CLOUD_TRUSTED_ORIGINS` for the actual browser origins.
- Keep `S3_CHECKSUM_VERIFICATION=metadata` for this SeaweedFS profile. OpenPencil stores the document SHA-256 as immutable object metadata and verifies it before committing a revision.
- Configure Google or Apple variables in `.env` only when enabling those providers.
- Configure `OPENPENCIL_CLOUD_CLEANUP_BATCH_SIZE`, `OPENPENCIL_CLOUD_CLEANUP_INTERVAL_MS`, and `OPENPENCIL_CLOUD_CLEANUP_LEASE_MS` for the expected upload volume. The Node runtime runs a bounded cleanup worker by default; set `OPENPENCIL_CLOUD_CLEANUP_ENABLED=false` when cleanup is managed by a separate process.
- Back up both named volumes. Immutable revision keys remove any dependency on bucket versioning, but do not replace backups.
- Scale PostgreSQL and SeaweedFS independently for production; the single-node services here prioritize an understandable reference setup.
