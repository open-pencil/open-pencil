# Deploying OpenPencil Cloud

OpenPencil Cloud runs as one Node 22+ process in front of PostgreSQL and an S3-compatible object
store, with optional SMTP for email. See [security.md](./security.md) for hardening checks.

## Local development

From the repository root, with Docker running:

```sh
bun run cloud:dev
# OpenPencil Cloud: https://<branch>.cloud.open-pencil.localhost
# Captured email:  https://<branch>.mail.open-pencil.localhost
```

The command starts PostgreSQL, SeaweedFS, and Mailpit from [`compose.yml`](./compose.yml) as a
Compose project named after the branch, publishes them on free loopback ports, writes an ignored
TOML file with the branch's Portless URLs under `generated/`, and runs the Cloud server on the host
with `bun --watch` behind Portless. Email and password sign-up is enabled, and every message lands
in Mailpit.

`bun run cloud:dev:down` stops the services and removes the Mailpit route; their volumes are kept.

## Self-hosting

1. Provision PostgreSQL 15 or later and an S3-compatible bucket.
2. Copy [`openpencil-cloud.example.toml`](./openpencil-cloud.example.toml) and set at least
   `deployment.public_url`, `deployment.app_url`, `deployment.trusted_origins`, and
   `[object_storage]`.
3. Copy [`.env.example`](./.env.example), point `OPENPENCIL_CLOUD_CONFIG` at the TOML file, and set
   the secrets.
4. Build and start the server from the repository root:

   ```sh
   bun --filter @open-pencil/cloud build:standalone
   node packages/cloud/dist-standalone/server.mjs
   ```

The server migrates the database before it accepts requests and listens on `PORT` (default `8787`)
and `HOST` (default `0.0.0.0`). `GET /ready` reports readiness. `dist-standalone/server.mjs`
bundles its dependencies, so it can be copied to a host without `node_modules`.

### Configuration

The TOML file owns URLs, enrollment, authentication providers, storage, email, worker schedules,
retention, entitlements, and technical limits. Environment variables only supply secrets, through
these default references: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `APPLE_PRIVATE_KEY`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
`S3_SESSION_TOKEN`, `OPENPENCIL_CLOUD_SMTP_USER`, and `OPENPENCIL_CLOUD_SMTP_PASSWORD`. Use
`{ from_env = "CUSTOM_NAME" }` to read a different variable. A missing required secret stops startup
and names the variable without printing any value.

### Enrollment and the first administrator

Set `authentication.enrollment_mode = "approval"` for a controlled deployment: a verified identity
then creates a pending request that an administrator reviews. Bootstrap the first operator with the
operator commands below; startup never grants roles or changes enrollment state.

```sh
bun --filter @open-pencil/cloud admin approve owner@example.com
# after that person signs in once
bun --filter @open-pencil/cloud admin grant owner@example.com
```

Deployment administrators are separate from workspace administrators.
`authentication.admin_user_ids` is an optional bootstrap list of immutable user IDs.

### Operator commands

Each command reads the same `OPENPENCIL_CLOUD_CONFIG` and secrets as the server:

| Command                                           | Purpose                                         |
| ------------------------------------------------- | ----------------------------------------------- |
| `bun --filter @open-pencil/cloud migrate`         | Apply database migrations                       |
| `bun --filter @open-pencil/cloud cleanup`         | Run one cleanup pass outside the server worker  |
| `bun --filter @open-pencil/cloud quota:reconcile` | Recompute stored usage from committed revisions |
| `bun --filter @open-pencil/cloud entitlements`    | Inspect or set a workspace's entitlements       |
| `bun --filter @open-pencil/cloud admin`           | Approve enrollment and grant deployment admin   |

### Collaboration relay

The server accepts collaboration WebSockets on `/api/collaboration/relay` on the same listener, so
a reverse proxy must forward WebSocket upgrades for that path. Collaboration tickets name the relay
at `deployment.public_url` with a `ws:` or `wss:` scheme; set `[collaboration] relay_url` when
clients reach it elsewhere. `technical_limits.maximum_collaboration_message_bytes` and
`maximum_connections_per_room` bound each room, and the `entitlements.collaboration` limits apply
per workspace.

### Transactional email

Set `email.transport = "smtp"` with an `[email.smtp]` table, or `"none"` to disable delivery; with
`"none"`, invitations still work through their links but no email is queued. `deployment.app_url`
is the editor origin used in invitation links and must also be in `deployment.trusted_origins`.
Messages go through an encrypted PostgreSQL outbox, tuned under `[workers.email]`; delivery records
that the relay accepted a message, not that it reached the inbox.

### Production notes

- Put the API and the object store behind TLS on stable hostnames.
- Replace every development credential, including those in `seaweedfs/s3.json` if you use it.
- Keep `object_storage.checksum_verification = "metadata"` for stores without native SHA-256
  checksums; OpenPencil stores the document digest as object metadata and verifies it before
  committing a revision.
- Size `[workers.cleanup]` for your upload volume and retention, or set `enabled = false` and run
  `cleanup` from a scheduler.
- Back up PostgreSQL and the bucket. Immutable revision keys remove the need for bucket versioning
  but are not a backup.

## End-to-end tests

```sh
bun --filter @open-pencil/cloud test:e2e         # PostgreSQL and SeaweedFS
bun --filter @open-pencil/cloud test:e2e:garage  # Garage S3 compatibility
```

Each runner starts an isolated Compose project and removes it with its volumes afterwards. The main
suite checks object-store readiness, a presigned single PUT and a 33 MiB three-part multipart upload
(ordered ETags, metadata SHA-256, size, verified GET, deletion), then the full revision flow against
real PostgreSQL: migrations, idempotent commits, stale-base conflicts, multipart cleanup, usage, and
soft deletion.

The Garage profile ([`compose.garage.yml`](./compose.garage.yml)) pins Garage `v2.3.0` as a single
node. Configure Cloud for it with `region = "garage"`, `force_path_style = true`, and
`checksum_verification = "metadata"`, and leave server-side encryption unset.
