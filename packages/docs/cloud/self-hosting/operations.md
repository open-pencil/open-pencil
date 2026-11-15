---
title: Operating Cloud
description: Run operator commands, track errors, back up, upgrade, and harden a self-hosted OpenPencil Cloud server.
---

# Operations

## Operator commands

Each runs from a repository checkout with the same `OPENPENCIL_CLOUD_CONFIG` and secrets as the server:

| Command                                           | Purpose                                         |
| ------------------------------------------------- | ----------------------------------------------- |
| `bun --filter @open-pencil/cloud migrate`         | Apply database migrations                       |
| `bun --filter @open-pencil/cloud cleanup`         | Run one cleanup pass outside the server worker  |
| `bun --filter @open-pencil/cloud quota:reconcile` | Recompute stored usage from committed revisions |
| `bun --filter @open-pencil/cloud entitlements`    | Inspect or set an account's entitlements        |
| `bun --filter @open-pencil/cloud admin`           | Approve enrollment and grant deployment admin   |

## Error tracking

The server reports nothing unless you ask it to. Add an `[error_tracking]` table with `provider = "posthog"` to send errors no request handled, and failures of startup once the configuration parses, background work, cleanup, email delivery, and the collaboration relay, to PostHog error tracking. `host` defaults to PostHog's EU Cloud, `https://eu.i.posthog.com`; set `https://us.i.posthog.com` or your own instance's address instead. The project API key defaults to `POSTHOG_PROJECT_API_KEY`. Each report carries the error's message and stack, the runtime, the deployment mode and host, where the error was caught, and for a request its method, route pattern, and request ID. It names no account and creates no person in PostHog, and it leaves out the client's address and the request body, though an error's message can quote a value the failing code handled, such as a malformed ID in a database error. Errors are logged either way, one JSON line each with its `level`, `message`, `source`, method, route, and `requestId`. On Cloudflare Workers that is the request's ray ID, its `cf-ray`; on Node and Bun, the `X-Request-Id` a proxy in front set, such as nginx's `$request_id`, else a new UUID. Behind Cloudflare, a Node server still uses `X-Request-Id`, so have the proxy set it to the ray ID if you want both to match. The server answers every HTTP request with that ID as `X-Request-Id`.

## Backups and upgrades

Back up PostgreSQL and the bucket together. To upgrade, build the new version, stop the old process, and start the new one: it applies migrations before it accepts requests. Migrations only move forward, so restore the database backup to roll back.

Cloud's migrations started over before the first stable release. A database created by an earlier build, a pre-release or one built from source, cannot be upgraded to a build that has the new migrations: recreate it and the bucket's documents. Recreate the services server's database too, or drop its tables when it shares Cloud's, since its migrations started over as well.

## Hardening

Replace every development credential, including the ones in the example Compose files. The [security checklist](https://github.com/open-pencil/open-pencil/blob/master/packages/cloud/deploy/security.md) covers the remaining checks.
