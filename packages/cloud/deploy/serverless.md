# Serverless deployment adapters

## Vercel Node

The Vercel adapter is under `deploy/vercel/` and uses the normal Node PostgreSQL and S3-compatible runtime. Configure the same Cloud environment variables as the Compose profile.

Before deploying a new application version, run migrations as a separate release step:

```sh
bun --filter @open-pencil/cloud migrate
```

Do not run migrations inside the request handler. Disable the in-process worker in serverless environments:

```text
OPENPENCIL_CLOUD_CLEANUP_ENABLED=false
```

Run cleanup from Vercel Cron or another scheduler as a one-shot command:

```sh
bun --filter @open-pencil/cloud cleanup
```

The cleanup command uses the same bounded, multi-worker-safe claims as the long-running Node worker.

## Cloudflare Workers reference adapter

The Worker assembly uses Hyperdrive for PostgreSQL and an R2 `DOCUMENTS` binding for object storage.
It signs short-lived same-origin upload and download URLs with the Cloud auth secret, stores SHA-256
checksums in R2 custom metadata, and currently advertises single-upload support only. Multipart uploads
remain disabled for this adapter.

Use the portable app assembly with:

- A Hyperdrive connection string and the Worker-compatible `pg` driver through an injected Kysely dialect.
- An injected S3-compatible object store, commonly Cloudflare R2's S3 endpoint.
- `nodejs_compat` for `pg` and Better Auth compatibility.
- A Cron Trigger that invokes the cleanup services through `ctx.waitUntil()`.
- Node/CI migration tooling using the origin PostgreSQL connection string.

The Worker request path does not run migrations or start timers. Configure account-specific
Hyperdrive and R2 IDs, set `BETTER_AUTH_SECRET` and application URL/trusted-origin secrets, and run
migrations from Node/CI. Invitation email still requires an injected Worker-compatible delivery
adapter before enabling invitation delivery in production.
