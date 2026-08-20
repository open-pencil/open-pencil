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

## Cloudflare Workers adapter skeleton

The checked-in Worker assembly is an adapter skeleton, not a deploy-ready R2 reference profile. It
currently supports Hyperdrive plus an S3-compatible object store configured through secret string
bindings. It does not yet consume an `R2Bucket` binding or provide a Worker invitation-delivery
binding.

To develop it further, use the portable app assembly with:

- A Hyperdrive connection string and the Worker-compatible `pg` driver through an injected Kysely dialect.
- An injected S3-compatible object store, commonly Cloudflare R2's S3 endpoint.
- `nodejs_compat` for `pg` and Better Auth compatibility.
- A Cron Trigger that invokes the cleanup services through `ctx.waitUntil()`.
- Node/CI migration tooling using the origin PostgreSQL connection string.

The Worker request path must not run migrations or start timers. For R2, configure its official
S3-compatible endpoint (`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`), region `auto`, path style
`false`, metadata checksum verification, and bucket-scoped read/write API credentials as Worker
secrets. The existing AWS SDK object store then produces standard SigV4 presigned GET, PUT, and
multipart URLs. Configure R2 bucket CORS to allow the editor origins and the `Content-Type`,
`x-amz-meta-openpencil-sha256`, and checksum headers used by uploads. Run PostgreSQL migrations from
Node/CI. Invitation email still requires an injected Worker-compatible delivery adapter before
production use.
