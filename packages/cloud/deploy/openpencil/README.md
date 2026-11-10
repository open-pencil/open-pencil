# Official deployments runbook

The OpenPencil team's own Cloud deployments, each a filled-in copy of `deploy/cloudflare`:

| Target       | Address                        | Deploys from        | Data                                             |
| ------------ | ------------------------------ | ------------------- | ------------------------------------------------ |
| `staging`    | `cloud-staging.openpencil.dev` | master or a release | Neon in `us-east-2`, R2 in eastern North America |
| `production` | `cloud.openpencil.dev`         | a release tag only  | EU: Neon, R2, and the relay rooms                |

The Deploy Cloud workflow (`.github/workflows/deploy-cloud.yml`) deploys a target with the secrets
and reviewers of its `cloud-<target>` GitHub environment. It stops before building when the ref may
not deploy to the target or its commit is not on master (`tools/ci/cloud-deploy/src/ref.ts`).

## Before production's first deploy

The values in `production/` marked "Replace" and these settings outside the repository:

- The `cloud-production` environment: required reviewers, deployment refs limited to tags `v*`,
  the `CLOUD_URL` variable, and the secrets the workflow names (`NEON_MIGRATOR_DATABASE_URL`, the
  Worker's secrets, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `POSTHOG_CLI_API_KEY`).
- A Neon project in an EU region, with a restore window of at least `purge_grace_days` (7).
- An R2 API token with Object Read & Write on the `openpencil-cloud` bucket only, whose keys are
  `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`. The bucket is in the EU jurisdiction, and its CORS
  rules allow GET, PUT, and HEAD from `https://cloud.openpencil.dev`.
- A Hyperdrive over the database's pooled connection with query caching off, since a cached read
  can miss the write just before it. Its ID goes in `production/wrangler.jsonc`.
- Google's OAuth client allowing `https://cloud.openpencil.dev/api/auth/callback/google`, Email
  Routing sending from `cloud@openpencil.dev`, and the services Worker at
  `services.openpencil.dev` trusting this Cloud's keys.

Rooms' Durable Objects run in Cloudflare's EU jurisdiction (`production/worker.ts`); the database
and the bucket, which hold rooms' updates and snapshots, have to be in the EU too for the data to
stay there. An object named in a jurisdiction is a different object from one named outside it, so
a deployment never changes its jurisdiction while rooms are open.

## Deploying

Staging first, then production, from the same tag:

```sh
gh workflow run deploy-cloud.yml --ref master -f target=staging
gh workflow run deploy-cloud.yml --ref v0.18.0 -f target=staging
gh workflow run deploy-cloud.yml --ref v0.18.0 -f target=production
```

The workflow uploads the Worker's source maps, migrates the database over its direct connection,
deploys the Worker, and checks that `/health`, `/ready`, and the pages answer 200.

## Migrations: expand, then contract

Migrations run before the new Worker, so for a moment the previous release serves on the new
schema, and stays on it after a rollback. A migration therefore only adds: no table or column
dropped, renamed, retyped, or newly required, and a column it adds to an existing table is nullable
or has a default. `tests/integration/server/db/expand.test.ts` fails on anything else.

Removing or tightening something takes two releases: the first stops using it, the second carries
a migration that names it in `contracts` (see `CloudMigration` in `src/server/db/migrate.ts`).
Never edit a migration that has shipped.

## Rolling back

Roll the Worker back to its previous version in the Cloudflare dashboard (Workers → the Worker →
Deployments) or with `wrangler rollback` in the target's folder. Do not run the workflow from an
older tag after a release that migrated: its migrate step stops because the database has a
migration that tag does not know. The schema stays as the newer release left it, which the older
code can use because migrations only expand.

A release whose migration is itself wrong is fixed forward with a new migration and release.

## Finding what failed

Each HTTP response carries its request's ID as `X-Request-Id`: Cloudflare's ray ID, the same as
its `cf-ray` header. Relay sockets have none; their errors log with `source` `relay`. Error log lines are JSON with `level`, `message`,
`source`, `method`, `route`, `requestId`, and `error`; filter Workers Logs (Workers → the Worker →
Observability) by `requestId`. The error's PostHog report carries the same ID as `request_id`.

## Backups and restores

What holds what:

- **Database:** everything but file contents, including each open room's updates, which a room
  saves about two seconds after an edit. Neon keeps history for its restore window.
- **Bucket:** revision files, images, and rooms' snapshots, each named by the row that holds it.
  Cleanup deletes the ones no row holds: a room's older snapshot when it compacts, and a deleted
  document's files. A document left in Trash goes after 30 days; one deleted forever goes
  `purge_grace_days` (7) later, and until then administrators restore it from the console's
  "Deleted forever" filter. R2 keeps no versions, so a file cleanup deleted is gone.
- **Rooms' Durable Objects:** an open room's document in memory, which they write back to the
  database and bucket.

To restore the database to an earlier time:

1. Take the Worker off the air: remove `cloud.openpencil.dev` from the Worker's Domains & Routes.
   Then deploy the same release again with `wrangler deploy` in `production/`, as the workflow's
   deploy step does: a new version restarts the rooms' objects and closes their sockets, so no room
   keeps newer state than the restore and writes it back. There is no maintenance page; people see
   the domain fail meanwhile.
2. Create a Neon branch at the time before the damage, check it, and restore the production branch
   from it in the Neon console. Hyperdrive keeps the same connection.
3. Migrate it as the workflow's migrate step does (`bun --filter @open-pencil/cloud migrate` with
   `production/openpencil-cloud.toml`, the direct connection, and the secrets the TOML names), so
   the schema matches the deployed Worker even if the restore point predates a migration.
4. Files the restored rows name that cleanup deleted since are gone; list them by the `object_key`
   of their `storage_object` rows, and the documents holding them will not open.
5. Put the domain back and open a document saved before the restore point.

## Restore drill

Once a quarter, and after changing the database's provider or plan:

1. Create a Neon branch of production at a time an hour back.
2. Check the branch's `kysely_migration` table names the latest migration in
   `src/server/db/migrate.ts` that production has run.
3. Point a local Cloud at the branch and the production bucket with read-only keys, sign in, and
   open a document saved before the branch's time.
4. Delete the branch, and note the date, the time the restore took, and anything that failed in the
   team's drill log.
