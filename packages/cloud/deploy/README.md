# OpenPencil Cloud reference deployment

See [Backend security checks](./security.md) for local and CI hardening guidance.

This profile runs OpenPencil Cloud with PostgreSQL 17, a SeaweedFS S3-compatible object store, and Mailpit for captured development email. It is intended as a self-hosting reference and local integration environment.

## Local development

From the repository root, use the worktree-safe orchestrator:

```sh
bun run cloud:dev
# OpenPencil Cloud: https://<branch>.cloud.open-pencil.localhost
# Captured email:  https://<branch>.mail.open-pencil.localhost
```

The command generates an ignored TOML file containing the current branch-scoped Portless origins, starts an isolated Compose project, and registers loopback-only Cloud and Mailpit routes. Local email/password registration is enabled. Open Mailpit to inspect Vue Email HTML/text and follow verification or reset links; its SMTP port is available only inside the Compose network.

Stop containers and remove their Portless aliases with:

```sh
bun run cloud:dev:down
```

## Standalone self-hosting reference

```sh
cd packages/cloud/deploy
cp .env.example .env
# Replace BETTER_AUTH_SECRET and storage/database credentials before exposing the service.
docker compose up -d --build
docker compose ps
curl --fail http://localhost:8787/ready
```

The Node runtime loads the versioned TOML file referenced by `OPENPENCIL_CLOUD_CONFIG`. Start from [`openpencil-cloud.example.toml`](./openpencil-cloud.example.toml). TOML owns deployment URLs, enrollment, authentication-provider enablement, storage behavior, email delivery, worker schedules, retention, entitlements, and technical limits. Environment variables resolve conventional secret references only; they do not silently override TOML values.

The default references are `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_PRIVATE_KEY`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_SESSION_TOKEN`, `OPENPENCIL_CLOUD_SMTP_USER`, and `OPENPENCIL_CLOUD_SMTP_PASSWORD`. Override a name with `{ from_env = "CUSTOM_NAME" }` only when required. Missing required references fail startup by variable name without exposing values. The legacy flat environment loader remains available only when `OPENPENCIL_CLOUD_CONFIG` is unset.

Cloudflare cannot mount TOML at runtime. Official deployment TOML files live under [`config/`](./config/) and `generate:cloudflare-config` validates them into a temporary structured Wrangler variable. Hyperdrive, Assets, Email Service, routes, cron triggers, and encrypted secrets remain native Cloudflare bindings.

The standalone Cloud application serves `/`, `/auth/sign-up`, `/auth/sign-in`, `/auth/verify-email`, `/auth/forgot-password`, `/auth/reset-password`, `/app`, and `/admin`. Compatibility routes preserve `/sign-up`, `/sign-in`, `/join`, and `/admin/sign-in`. Direct Compose host bindings are loopback-only; prefer the Portless development workflow above for browser access. PostgreSQL and SeaweedFS ports remain available on loopback for local inspection and smoke tests.

### Enrollment and first administrator

Set `authentication.enrollment_mode = "approval"` in TOML for a controlled deployment. A verified identity creates a pending account that an administrator can review.

```sh
bun --filter @open-pencil/cloud admin approve owner@example.com
```

After that user signs in once and Better Auth creates the account, grant deployment administration:

```sh
bun --filter @open-pencil/cloud admin grant owner@example.com
```

Deployment administrators are distinct from workspace administrators. `authentication.admin_user_ids` is an optional immutable-ID bootstrap escape hatch; ordinary administration uses Better Auth's persisted `admin` role. Startup never grants roles or changes enrollment state.

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

### Transactional email

`deployment.public_url` configures the API origin. `deployment.app_url` configures the browser editor origin used in emailed invitation links and must also appear in `deployment.trusted_origins`.

Vue Email renders matching HTML and plain-text bodies. PostgreSQL owns an encrypted, idempotent outbox with bounded claims and retries; the transport records relay acceptance rather than claiming inbox delivery.

For local development, Compose pins Mailpit `v1.31.0`. The Cloud container sends unauthenticated SMTP to `mailpit:1025` on the private Compose network; only the Mailpit HTTP UI is bound to loopback and exposed through Portless. Its SQLite mailbox is retained in `cloud-mailpit`, pruned to 500 messages or seven days, and never relays externally.

Cloudflare deployments set `email.transport = "cloudflare"` and `email.from` in deployment TOML, then configure the `EMAIL` `send_email` binding in `cloudflare/wrangler.jsonc`. The sending domain must be onboarded to Cloudflare Email Service. The scheduled Worker drains the same PostgreSQL outbox service used by Node; the binding is only a transport adapter.

Set `email.transport = "none"` when delivery is intentionally disabled. In that mode document invitations remain token-based but no email outbox row is created. Delivery tuning lives under `[workers.email]`.

### Cloud collaboration relay

Configure `[collaboration]` with `public_url` and `port` for a dedicated Hocuspocus WebSocket endpoint that issues Cloud collaboration tickets with server-enforced write permissions. The relay validates the signed
Cloud ticket, binds it to the document epoch room, marks viewers read-only, supports active token
refresh through Hocuspocus, stamps awareness with server-verified document/permission metadata, and
persists binary Yjs state through the official Hocuspocus database extension. Cloud relay sessions use
PostgreSQL rather than browser IndexedDB for room persistence.
Without this setting, Cloud documents retain the temporary Trystero path and advertise that writes
are not server-enforced.

Compose host ports can be overridden with `OPENPENCIL_CLOUD_PORT`, `MAILPIT_UI_PORT`, `POSTGRES_PORT`,
`SEAWEEDFS_S3_PORT`, and `SEAWEEDFS_MASTER_PORT`. This is useful for parallel deployments and CI; the
container ports remain unchanged. `bun run cloud:dev` assigns Cloud and Mailpit ports dynamically and
should be preferred for interactive development.

## Stop

```sh
docker compose down
```

Add `--volumes` only when you intentionally want to remove all persisted Cloud data.

## Production notes

- Put the Cloud API and S3 endpoint behind TLS with stable public hostnames.
- Change every development credential in `.env` and in `seaweedfs/s3.json`; both locations must agree.
- Approval-gated enrollment creates a pending record only after the identity provider verifies the account. Pending, rejected, and revoked accounts can read their own status but cannot access product or administration APIs. Configure `authentication.admin_notification_emails` to notify deployment administrators.
- Configure `deployment.public_url`, `deployment.app_url`, and `deployment.trusted_origins` for the actual browser origins.
- Keep `object_storage.checksum_verification = "metadata"` for this SeaweedFS profile. OpenPencil stores the document SHA-256 as immutable object metadata and verifies it before committing a revision.
- Add a Google or Apple provider table only when enabling that provider, and supply its required secret references externally.
- Configure `[workers.cleanup]` for the expected upload volume and retention policy. The Node runtime runs a bounded cleanup worker by default; set `enabled = false` when cleanup is managed by a separate process.
- Back up both named volumes. Immutable revision keys remove any dependency on bucket versioning, but do not replace backups.
- Scale PostgreSQL and SeaweedFS independently for production; the single-node services here prioritize an understandable reference setup.
