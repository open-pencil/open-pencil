# OpenPencil Cloud reference deployment

See [Backend security checks](./security.md) for local and CI hardening guidance.

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

The Node runtime prefers the versioned TOML file referenced by `OPENPENCIL_CLOUD_CONFIG` and falls
back to the legacy environment mapping when no path is configured. Start from
[`openpencil-cloud.example.toml`](./openpencil-cloud.example.toml). TOML contains infrastructure and
technical ceilings; production secrets are resolved through `from_env` references.

The Cloud API is available at `http://localhost:8787`. PostgreSQL and SeaweedFS are also published on ports `54329`, `8333`, and `9333` for local inspection and smoke tests.

The Cloud container runs database migrations before accepting requests. Named volumes preserve PostgreSQL and SeaweedFS data across restarts.

## Object-store smoke test

From the repository root:

```sh
bun --filter @open-pencil/cloud test:e2e
```

The test runner creates an isolated Compose project and removes its containers and volumes when finished. It verifies object-store readiness, a presigned single PUT, and a 33 MiB, three-part presigned upload, including ordered ETags, completion, metadata SHA-256, object size, verified GET bytes, and deletion. It then exercises the complete Cloud API revision flow against real PostgreSQL and SeaweedFS, including migrations, idempotent commits, stale-base conflicts, multipart cleanup, usage, and soft deletion.

## Garage compatibility profile

Garage is available as a lightweight secondary S3-compatible profile:

```sh
cd packages/cloud/deploy
docker compose -f compose.garage.yml up -d --wait
```

Run its isolated compatibility test from the repository root:

```sh
bun --filter @open-pencil/cloud test:e2e:garage
```

The profile pins Garage `v2.3.0`, creates a single-node layout, access key, and bucket automatically, and persists metadata and object data in separate volumes. Configure Cloud with:

```text
S3_ENDPOINT=http://garage:3900
S3_REGION=garage
S3_FORCE_PATH_STYLE=true
S3_CHECKSUM_VERIFICATION=metadata
```

Do not configure `S3_SERVER_SIDE_ENCRYPTION` or `S3_KMS_KEY_ID` for Garage. This profile verifies integrity through OpenPencil SHA-256 object metadata rather than provider-computed native S3 checksums. The single-node profile is for compatibility and lightweight self-hosting; production redundancy requires a deliberate multi-node Garage layout.

Stop and remove the Garage profile with:

```sh
docker compose -f compose.garage.yml down
```

### Invitation email

`OPENPENCIL_CLOUD_URL` configures the API origin. `OPENPENCIL_CLOUD_APP_URL` configures the browser editor origin used in emailed invitation links and must also appear in `OPENPENCIL_CLOUD_TRUSTED_ORIGINS`.

The Node deployment can send document invitations through SMTP. Configure
`OPENPENCIL_CLOUD_SMTP_HOST`, `OPENPENCIL_CLOUD_SMTP_PORT`,
`OPENPENCIL_CLOUD_SMTP_SECURE`, and `OPENPENCIL_CLOUD_EMAIL_FROM`. Add
`OPENPENCIL_CLOUD_SMTP_USER` and `OPENPENCIL_CLOUD_SMTP_PASSWORD` together when
the server requires authentication. Vue Email renders matching HTML and plain-text bodies.
Cloudflare deployments should inject an HTTP-based `InvitationDelivery` adapter instead of
Nodemailer.

### Cloud collaboration relay

Set `OPENPENCIL_CLOUD_COLLABORATION_URL` to a dedicated Hocuspocus WebSocket endpoint and
`OPENPENCIL_CLOUD_COLLABORATION_PORT` to the local listener port to issue
Cloud collaboration tickets with server-enforced write permissions. The relay validates the signed
Cloud ticket, binds it to the document epoch room, marks viewers read-only, supports active token
refresh through Hocuspocus, stamps awareness with server-verified document/permission metadata, and
persists binary Yjs state through the official Hocuspocus database extension. Cloud relay sessions use
PostgreSQL rather than browser IndexedDB for room persistence.
Without this setting, Cloud documents retain the temporary Trystero path and advertise that writes
are not server-enforced.

Compose host ports can be overridden with `OPENPENCIL_CLOUD_PORT`, `POSTGRES_PORT`,
`SEAWEEDFS_S3_PORT`, and `SEAWEEDFS_MASTER_PORT`. This is useful for parallel deployments and CI; the
container ports remain unchanged.

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
- Configure `OPENPENCIL_CLOUD_CLEANUP_BATCH_SIZE`, `OPENPENCIL_CLOUD_CLEANUP_INTERVAL_MS`, and `OPENPENCIL_CLOUD_CLEANUP_LEASE_MS` for the expected upload volume. Deleted documents remain recoverable for `OPENPENCIL_CLOUD_DOCUMENT_RETENTION_MS` (30 days by default) before immutable revisions and objects are physically collected. The Node runtime runs a bounded cleanup worker by default; set `OPENPENCIL_CLOUD_CLEANUP_ENABLED=false` when cleanup is managed by a separate process.
- Back up both named volumes. Immutable revision keys remove any dependency on bucket versioning, but do not replace backups.
- Scale PostgreSQL and SeaweedFS independently for production; the single-node services here prioritize an understandable reference setup.
