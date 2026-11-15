---
title: Cloud on Cloudflare Workers
description: Deploy OpenPencil Cloud on Cloudflare Workers with Durable Objects for collaboration and Hyperdrive for PostgreSQL.
---

# Cloudflare Workers

On Cloudflare a Worker serves the API, the editor, and the server's own pages, a Durable Object for each document runs its collaboration rooms, Hyperdrive connects to PostgreSQL, and a Cron Trigger every five minutes runs cleanup and retries email. [`packages/cloud/deploy/cloudflare`](https://github.com/open-pencil/open-pencil/tree/master/packages/cloud/deploy/cloudflare) is the deployment to copy: a Wrangler configuration and the Worker's entry, which reads `openpencil-cloud.toml` from the same folder.

1. Copy the folder beside it, for example to `packages/cloud/deploy/mine`, so the Worker's entry still reaches the runtime.
2. Create a Hyperdrive configuration for the database with `wrangler hyperdrive create`, and put its ID, your domain, and a Worker name in the copy's `wrangler.jsonc`.
3. Add your TOML as `openpencil-cloud.toml` in the copy; Wrangler bundles it as text. Leave `[database]` empty, since `DATABASE_URL` comes from Hyperdrive, and trust `cf-connecting-ip` under `[authentication.trusted_proxies]`.
4. Migrate from a checkout, with that TOML as `OPENPENCIL_CLOUD_CONFIG` and a direct connection string as `DATABASE_URL`: `bun --filter @open-pencil/cloud migrate`. The Worker never migrates, so do this before every deploy.
5. Build the site with `bun run build:packages && bun run build:cloud`, then deploy from the copy with `bunx wrangler deploy --assets "$(git rev-parse --show-toplevel)/dist-cloud" --secrets-file secrets.json`, where `secrets.json` holds the secrets the TOML names.

To run collaboration rooms in one region, name a Durable Object jurisdiction in the Worker's entry: `createCloudflareCloud(config, { relayJurisdiction: 'eu' })`. Rooms save their updates and snapshots to the database and bucket, so put those in the same region too. Set it before the first room opens, since rooms named in a jurisdiction are other objects than those named outside one.

The [operator commands](./operations#operator-commands) work the same way, from a checkout with a direct connection. The `[workers]` intervals don't apply: mail a request queues is sent when the request finishes, and the Cron Trigger handles the rest.
