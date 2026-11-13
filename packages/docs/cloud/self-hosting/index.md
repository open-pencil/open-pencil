---
title: Self-hosting OpenPencil Cloud
description: Run your own OpenPencil Cloud server with PostgreSQL and an S3-compatible bucket, as a Node process or on Cloudflare Workers.
---

# Self-hosting OpenPencil Cloud

OpenPencil Cloud is one Node 22+ process in front of PostgreSQL 15 or later and an S3-compatible object store, with optional SMTP for email. The same process serves the API, the collaboration relay, the editor, and the server's own pages for signing in, account security, and administration. It also runs on [Cloudflare Workers](./cloudflare) with the same configuration. People connect to it from the editor as described in [OpenPencil Cloud](/cloud/).

## Install

Each release publishes an image, `ghcr.io/open-pencil/cloud`, with the server and the editor and pages it serves, for `linux/amd64` and `linux/arm64`. It is tagged with the version (`0.16.0`), the minor version (`0.16`), and `latest`; prereleases are tagged with their version and `next`. Give it the [configuration](#configure) through a mounted TOML file and the environment:

```sh
docker run -p 8787:8787 \
  -v ./openpencil-cloud.toml:/etc/openpencil/openpencil-cloud.toml:ro \
  -e OPENPENCIL_CLOUD_CONFIG=/etc/openpencil/openpencil-cloud.toml \
  --env-file .env \
  ghcr.io/open-pencil/cloud:0.16
```

The image serves its own editor and pages from `/app/site`, so leave `OPENPENCIL_CLOUD_SITE_DIR` out of the `.env` it is given, or the variable points the server somewhere the container does not have. It listens on port 8787, and reports health from `GET /ready`. `docker run … ghcr.io/open-pencil/cloud node services.mjs` runs the [services server](./ai-services) instead.

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

For a server only its members use, set `deployment.local_editor = false`: the welcome page then offers only signing in, and every editor page asks for it. To keep shared links to members too, turn off `guest_view`, `guest_edit`, and `guest_presence` under `[entitlements.sharing]`; links then open after signing in to the server. With `guest_view` on and `guest_edit` off, as the shipped configurations have it, a guest opens an edit link view-only and signs in to edit.

Links the server sends point at its own address: `/documents/<id>` for a document, `/share/<id>` for a shared link, and `/invitations/<id>` for an invitation. An editor at another address, such as a development build, can still connect when its origin is in `deployment.trusted_origins`; people sign in there by approving a code, as in the desktop app.

## Reverse proxy

- Terminate TLS in front of the server and the object store, on stable hostnames.
- Forward WebSocket upgrades for `/api/collaboration/relay`. Collaboration tickets name the relay at `public_url` with a `ws:` or `wss:` scheme; set `[collaboration] relay_url` when clients reach it elsewhere.
- The object store must accept presigned uploads from the editor's origins: allow `PUT` and `GET` from `public_url` and any `trusted_origins` in its CORS rules, with the `Range` request header, which Home uses to read a document's preview without downloading the whole file.

## The first administrator

Set `[authentication.enrollment] mode = "approval"` for a controlled deployment: a verified identity then creates a pending request that an administrator reviews. Startup never grants roles, so bootstrap the first operator from a repository checkout that reads the same configuration and secrets and can reach the server's database at `DATABASE_URL`:

```sh
bun --filter @open-pencil/cloud admin approve owner@example.com
# after that person signs in once
bun --filter @open-pencil/cloud admin grant owner@example.com
```

Deployment administrators manage enrollment and users in the server's administration pages. They are separate from workspace administrators.

## Terms and privacy

The server shows no terms or privacy policy of its own: you run it, so the documents are yours to write. Add a `[legal]` table to link them. `terms_url` and `privacy_url` appear under the sign-in buttons and in the footer of the server's pages, `abuse_email` as a Report abuse link there, and `minimum_age` as a line at sign-up; editors read them from discovery too. With `require_acceptance = true`, which needs both `terms_url` and `terms_version`, each account accepts that version on its first sign-in, and again whenever you change it, before it can use the server; declining signs out. Until it accepts, the account can still download its documents and delete itself from the terms page, and nothing else. The server records which version each account accepted and when, so give each version that needs accepting again a value never used before: going back to an earlier one asks nobody who accepted it.

## Community gallery

Add a `[community]` table with a workspace's ID to make that workspace a public gallery:

```toml
[community]
workspace = "0f6b1c1e-6a8e-4b8e-9a4f-3c2d1e0f9a8b"
```

Anyone can then open its documents read-only, without signing in or a share link, and **everything saved there is public**: saving a document to the workspace publishes it, and moving it out or to Trash takes it down. Its members work in it as in any workspace. A document the members couldn't open either, because it is in Trash, an administrator blocked it, it was never saved, or its creator is banned, stays out of the gallery.

The gallery is served without signing in:

- `GET /api/community` lists its documents, most recently changed first, each with its named versions and the path of its thumbnail.
- `GET /api/community/<document>/document` downloads a document as it is now, or with `?version=<version>` as one of its named versions; other history stays private.
- `GET /api/community/thumbnails/<document>/<revision>` is the thumbnail the document's saved file carries. The address changes with each save. It is cached for five minutes, like the list, so a document taken down or moved out of the gallery stops showing soon after.

Name a version for each state you want people to be able to open later, such as a release.

These routes are limited per visitor by IP address, which the server only knows from a header your proxy sets. The proxy must overwrite that header or append the client's address to it; one it passes through unchanged is whatever the client sent. Name that header under `[authentication.trusted_proxies]` before you turn the gallery on, and let only the proxy reach the server: a request without the header has no IP to count, so nothing limits it.

