---
title: Self-hosting OpenPencil Cloud
description: Run your own OpenPencil Cloud server with PostgreSQL and an S3-compatible bucket, as a Node process or on Cloudflare Workers.
---

# Self-hosting OpenPencil Cloud

OpenPencil Cloud is one Node 22+ process in front of PostgreSQL 15 or later and an S3-compatible object store, with optional SMTP for email. The same process serves the API, the collaboration relay, the editor, and the server's own pages for signing in, account security, and administration. It also runs on [Cloudflare Workers](#cloudflare-workers) with the same configuration. People connect to it from the editor as described in [OpenPencil Cloud](/user-guide/openpencil-cloud).

## Install

Each release publishes an image, `ghcr.io/open-pencil/cloud`, with the server and the editor and pages it serves, for `linux/amd64` and `linux/arm64`. It is tagged with the version (`0.16.0`), the minor version (`0.16`), and `latest`; prereleases are tagged with their version and `next`. Give it the [configuration](#configure) through a mounted TOML file and the environment:

```sh
docker run -p 8787:8787 \
  -v ./openpencil-cloud.toml:/etc/openpencil/openpencil-cloud.toml:ro \
  -e OPENPENCIL_CLOUD_CONFIG=/etc/openpencil/openpencil-cloud.toml \
  --env-file .env \
  ghcr.io/open-pencil/cloud:0.16
```

The image serves its own editor and pages from `/app/site`, so leave `OPENPENCIL_CLOUD_SITE_DIR` out of the `.env` it is given, or the variable points the server somewhere the container does not have. It listens on port 8787, and reports health from `GET /ready`. `docker run … ghcr.io/open-pencil/cloud node ai-relay.mjs` runs the [AI relay](#ai) instead.

To try it on one machine, [`compose.self-hosted.yml`](https://github.com/open-pencil/open-pencil/blob/master/packages/cloud/deploy/compose.self-hosted.yml) runs the image with PostgreSQL, SeaweedFS for storage, and Mailpit for email, configured by [`self-hosted/openpencil-cloud.toml`](https://github.com/open-pencil/open-pencil/blob/master/packages/cloud/deploy/self-hosted/openpencil-cloud.toml):

```sh
cd packages/cloud/deploy
BETTER_AUTH_SECRET=$(openssl rand -hex 32) docker compose -f compose.self-hosted.yml up
```

Open `http://localhost:8787` and sign up; the confirmation email is at `http://localhost:8025`. Its storage keys and passwords are fixed development values, and it answers only on this machine, so set up your own database, storage, and email for a server other people use.

The server alone is also published to npm as `@open-pencil/cloud` and runs on Node 22 or later. It does not include the editor and pages, `dist-cloud/`, which are built from a checkout as below; without them the server runs its API alone.

```sh
npm install -g @open-pencil/cloud
openpencil-cloud --help
```

## Build from source

From a checkout of the repository:

```sh
bun install
bun run build:packages
bunx playwright install --with-deps chromium     # draws the demo document's shader fills
bun run build:cloud                              # writes dist-cloud/: the editor and the server's pages
bun --filter @open-pencil/cloud build:standalone # writes packages/cloud/dist-standalone/
```

`dist-standalone/` bundles the server's dependencies, so copy the whole directory, together with `dist-cloud/`, to a host that has Node but no `node_modules`. Start the server with `node dist-standalone/server.mjs`, or with `openpencil-cloud` when it is installed from npm.

## Configure

Settings live in a TOML file; environment variables supply secrets and tell the server where that file and the site build are and where to listen.

1. Copy [`openpencil-cloud.example.toml`](https://github.com/open-pencil/open-pencil/blob/master/packages/cloud/deploy/openpencil-cloud.example.toml) and set at least:
   - `deployment.public_url`: the address the server answers on, for example `https://cloud.example.com`;
   - `[object_storage]`: the bucket's endpoint, region, and name.
2. Copy [`.env.example`](https://github.com/open-pencil/open-pencil/blob/master/packages/cloud/deploy/.env.example) and set:
   - `OPENPENCIL_CLOUD_CONFIG`: the path to the TOML file;
   - `OPENPENCIL_CLOUD_SITE_DIR`: the path to `dist-cloud/`. Without it the server still runs its API, but the editor and the sign-in, account, and administration pages answer 404, and it warns at startup;
   - the secrets the TOML names, by default `DATABASE_URL`, `BETTER_AUTH_SECRET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`, plus `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_PRIVATE_KEY`, `S3_SESSION_TOKEN`, `OPENPENCIL_CLOUD_SMTP_USER`, and `OPENPENCIL_CLOUD_SMTP_PASSWORD` when their sections are enabled.
3. Start the server with the environment loaded, for example `node --env-file=.env dist-standalone/server.mjs`, or, installed from npm, `node --env-file=.env "$(command -v openpencil-cloud)"`.

Use `{ from_env = "CUSTOM_NAME" }` in the TOML to read a secret from a different variable. A missing required secret stops startup and names the variable without printing a value.

The server migrates the database before it accepts requests and listens on `PORT` (default `8787`) and `HOST` (default `0.0.0.0`). `GET /ready` reports readiness.

## The editor address

The server serves the editor at its own address. Visitors who are not signed in get a welcome page there first, where they sign in or use the editor without an account. Signed-in people whose account may use the server get the editor, already connected to it; an account waiting for approval gets a page that says so. Invitation and share links open the editor too.

For a server only its members use, set `deployment.local_editor = false`: the welcome page then offers only signing in, and every editor page asks for it. To keep shared links to members too, turn off `guest_view`, `guest_edit`, and `guest_presence` under `[entitlements.sharing]`; links then open after signing in to the server.

Links the server sends point at its own address: `/documents/<id>` for a document, `/share/<id>` for a shared link, and `/invitations/<id>` for an invitation. An editor at another address, such as a development build, can still connect when its origin is in `deployment.trusted_origins`; people sign in there by approving a code, as in the desktop app.

## Reverse proxy

- Terminate TLS in front of the server and the object store, on stable hostnames.
- Forward WebSocket upgrades for `/api/collaboration/relay`. Collaboration tickets name the relay at `public_url` with a `ws:` or `wss:` scheme; set `[collaboration] relay_url` when clients reach it elsewhere.
- The object store must accept presigned uploads from the editor's origins: allow `PUT` and `GET` from `public_url` and any `trusted_origins` in its CORS rules, with the `Range` request header, which Home uses to read a document's preview without downloading the whole file.

## Cloudflare Workers

On Cloudflare a Worker serves the API, the editor, and the server's own pages, a Durable Object for each document runs its collaboration rooms, Hyperdrive connects to PostgreSQL, and a Cron Trigger every five minutes runs cleanup and retries email. [`packages/cloud/deploy/cloudflare`](https://github.com/open-pencil/open-pencil/tree/master/packages/cloud/deploy/cloudflare) is the deployment to copy: a Wrangler configuration and the Worker's entry, which reads `openpencil-cloud.toml` from the same folder.

1. Copy the folder beside it, for example to `packages/cloud/deploy/mine`, so the Worker's entry still reaches the runtime.
2. Create a Hyperdrive configuration for the database with `wrangler hyperdrive create`, and put its ID, your domain, and a Worker name in the copy's `wrangler.jsonc`.
3. Add your TOML as `openpencil-cloud.toml` in the copy; Wrangler bundles it as text. Leave `[database]` empty, since `DATABASE_URL` comes from Hyperdrive, and trust `cf-connecting-ip` under `[authentication.trusted_proxies]`.
4. Migrate from a checkout, with that TOML as `OPENPENCIL_CLOUD_CONFIG` and a direct connection string as `DATABASE_URL`: `bun --filter @open-pencil/cloud migrate`. The Worker never migrates, so do this before every deploy.
5. Build the site with `bun run build:packages && bun run build:cloud`, then deploy from the copy with `bunx wrangler deploy --assets "$(git rev-parse --show-toplevel)/dist-cloud" --secrets-file secrets.json`, where `secrets.json` holds the secrets the TOML names.

The operator commands below work the same way, from a checkout with a direct connection. The `[workers]` intervals don't apply: mail a request queues is sent when the request finishes, and the Cron Trigger handles the rest.

## The first administrator

Set `[authentication.enrollment] mode = "approval"` for a controlled deployment: a verified identity then creates a pending request that an administrator reviews. Startup never grants roles, so bootstrap the first operator from a repository checkout that reads the same configuration and secrets and can reach the server's database at `DATABASE_URL`:

```sh
bun --filter @open-pencil/cloud admin approve owner@example.com
# after that person signs in once
bun --filter @open-pencil/cloud admin grant owner@example.com
```

Deployment administrators manage enrollment and users in the server's administration pages. They are separate from workspace administrators.

## Operator commands

Each runs from a repository checkout with the same `OPENPENCIL_CLOUD_CONFIG` and secrets as the server:

| Command                                           | Purpose                                         |
| ------------------------------------------------- | ----------------------------------------------- |
| `bun --filter @open-pencil/cloud migrate`         | Apply database migrations                       |
| `bun --filter @open-pencil/cloud cleanup`         | Run one cleanup pass outside the server worker  |
| `bun --filter @open-pencil/cloud quota:reconcile` | Recompute stored usage from committed revisions |
| `bun --filter @open-pencil/cloud entitlements`    | Inspect or set a workspace's entitlements       |
| `bun --filter @open-pencil/cloud admin`           | Approve enrollment and grant deployment admin   |

## AI

Cloud does not run models itself. It advertises an AI service and signs short-lived tokens that let workspace members use it, and the service holds each workspace to the credit allowance its entitlements grant. The repository's AI relay is a minimal service for this: it forwards chat completions to one OpenAI-compatible upstream, such as OpenRouter, with your key.

1. Create a P-256 signing key, `openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256`, and pass the PEM in `OPENPENCIL_CLOUD_AI_SIGNING_KEY`. Cloud refuses to start with a key it cannot sign with.
2. Add `[ai] endpoint` to the Cloud TOML with the relay's address, and enable `[entitlements.ai]`, optionally with a `monthly_credit_allowance`; without one, the relay does not limit spend. With entitlements from the database, set them per workspace with the `entitlements` command instead.
3. Copy [`openpencil-ai-relay.example.toml`](https://github.com/open-pencil/open-pencil/blob/master/packages/cloud/deploy/openpencil-ai-relay.example.toml), set `relay.cloud_url` to Cloud's `public_url`, `allowed_origins` to the browser editors, and list the models with their credit prices.
4. Start it with `OPENPENCIL_AI_RELAY_CONFIG`, `OPENPENCIL_AI_RELAY_UPSTREAM_KEY`, and `DATABASE_URL` set: `node --env-file=.env dist-standalone/ai-relay.mjs`, or `openpencil-ai-relay` from the npm package. It listens on `PORT` (default `8788`) and can share Cloud's database, keeping its own tables and migration history.

The relay charges a request once the upstream reports its usage, and admits one while the workspace has credits left, so requests already in flight can overdraw the month's allowance by what they cost; `relay.max_concurrent_requests` bounds them. A workspace's allowance renews at the start of each UTC month. The editor's chat shows how many credits are left, and once they run out it says when the allowance renews and asks members to contact you; with no `[billing]` table it offers nothing to buy. It refuses a model request larger than `relay.max_request_bytes` (16 MiB by default) before reading it all. Choose an upstream that reports token usage: a request it reports none for is logged as an error and not charged.

## Email

Set `email.transport = "smtp"` with an `[email.smtp]` table, `"cloudflare"` on Cloudflare Workers to send through Cloudflare Email Service from an address on a domain onboarded to it (the Worker needs the `send_email` binding named `EMAIL`, and sending to addresses you haven't verified needs Workers Paid), or `"none"` to send nothing; invitations still work through their links. Messages go through an encrypted outbox in PostgreSQL, tuned under `[workers.email]`. Delivery records that the SMTP server accepted a message, not that it reached the inbox.

## Storage

Any S3-compatible store works; the project tests against SeaweedFS and Garage. Keep `object_storage.checksum_verification = "metadata"` for stores without native SHA-256 checksums: OpenPencil stores each document's digest as object metadata and verifies it before committing a revision. For Garage, set `region = "garage"` and `force_path_style = true`, and leave server-side encryption unset. For Cloudflare R2, use the endpoint `https://<account ID>.r2.cloudflarestorage.com` with `region = "auto"` and `force_path_style = false`.

Revision keys are immutable, so bucket versioning isn't needed, but it isn't a backup either. Size `[workers.cleanup]` for your upload volume and retention, or set `enabled = false` and run `cleanup` from a scheduler.

## Backups and upgrades

Back up PostgreSQL and the bucket together. To upgrade, build the new version, stop the old process, and start the new one: it applies migrations before it accepts requests. Migrations only move forward, so restore the database backup to roll back.

## Hardening

Replace every development credential, including the ones in the example Compose files. The [security checklist](https://github.com/open-pencil/open-pencil/blob/master/packages/cloud/deploy/security.md) covers the remaining checks.
