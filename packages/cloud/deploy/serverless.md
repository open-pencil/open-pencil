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

## Cloudflare Workers

Cloudflare Workers should use the portable app assembly with:

- A Hyperdrive connection string and the Worker-compatible `pg` driver through an injected Kysely dialect.
- An injected S3-compatible object store, commonly Cloudflare R2's S3 endpoint.
- `nodejs_compat` for `pg` and Better Auth compatibility.
- A Cron Trigger that invokes the cleanup services through `ctx.waitUntil()`.
- Node/CI migration tooling using the origin PostgreSQL connection string.

The Worker request path must not run migrations or start timers. A production Worker profile also requires deployment-specific secret bindings, Hyperdrive and R2 identifiers, so this repository provides the runtime boundary rather than committing account-specific Wrangler IDs.
