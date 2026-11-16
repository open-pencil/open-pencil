# Official deployments runbook

The OpenPencil team's own Cloud deployments, each a filled-in copy of `deploy/cloudflare`:

| Target       | Address                        | Deploys from        | Data                                             |
| ------------ | ------------------------------ | ------------------- | ------------------------------------------------ |
| `staging`    | `cloud-staging.openpencil.dev` | master or a release | Neon in `us-east-2`, R2 in eastern North America |
| `production` | `cloud.openpencil.dev`         | what staging runs   | EU: Neon, R2, and the relay rooms                |

The Deploy Cloud workflow (`.github/workflows/deploy-cloud.yml`) deploys a target with the secrets
and reviewers of its `cloud-<target>` GitHub environment. Staging deploys the commit it is run
from; production promotes the commit staging runs, once staging's newest deployment succeeded
(`tools/ci/cloud-deploy/src/commit.ts`). Either stops before building when it is run from anything
but master or a release tag, or the commit is not on master (`tools/ci/cloud-deploy/src/ref.ts`).

## Billing

A deployment whose `openpencil-cloud.toml` names `[billing]` sets plans through `[internal_api]`,
with database entitlements whose values are the free plan; staging does. Its GitHub environment
then holds `OPENPENCIL_CLOUD_SERVICE_TOKEN`, which the workflow passes on only where it is set,
and the billing Worker holds the same token as `CLOUD_SERVICE_TOKEN`. Make it once and give it to
both in your own terminal, so it is never shown:

```sh
token=$(openssl rand -base64 32)
printf %s "$token" | gh secret set OPENPENCIL_CLOUD_SERVICE_TOKEN --env cloud-staging
printf %s "$token" | bunx wrangler secret put CLOUD_SERVICE_TOKEN -c wrangler.billing.jsonc   # in openpencil-commerce
unset token
```

## Before production's first deploy

These settings outside the repository:

- The `cloud-production` environment: required reviewers, deployment refs limited to `master` and tags `v*`,
  the `CLOUD_URL` variable, and the secrets the workflow names (`NEON_MIGRATOR_DATABASE_URL` and
  the Worker's secrets). `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `POSTHOG_CLI_API_KEY`
  are repository secrets: the job that picks the commit reads production's Worker before any
  environment's reviewers approve the deploy.
- A Neon project in an EU region, with a restore window of at least `purge_grace_days` (7), whose
  `openpencil_cloud` database belongs to a migrator role (`NEON_MIGRATOR_DATABASE_URL`) and is
  used by a runtime role, which Hyperdrive connects as. The migrator gives the runtime role
  `CONNECT` on the database, `USAGE` on `public`, and by default read and write on its tables and
  sequences (`ALTER DEFAULT PRIVILEGES FOR ROLE <migrator> IN SCHEMA public GRANT SELECT, INSERT,
  UPDATE, DELETE ON TABLES TO <runtime>`, and `SELECT, USAGE ON SEQUENCES`), as on staging.
- An R2 API token with Object Read & Write on the `openpencil-cloud` bucket only, whose keys are
  `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`. The bucket is in the EU jurisdiction, and its CORS
  rules allow GET, PUT, and HEAD from `https://cloud.openpencil.dev` with any request header
  (uploads send `Content-Type` and `x-amz-meta-openpencil-sha256`) and expose `ETag`, which
  multipart uploads read for each part. Its `expire-deleted` lifecycle rule removes what
  `deleted_prefix` keeps after 14 days, longer than the database's restore window.
- A Hyperdrive over the database's direct connection, as the runtime role, with query caching
  off, since a cached read can miss the write just before it. Hyperdrive pools connections itself,
  as staging's does. Its ID goes in `production/wrangler.jsonc`.
- Google's OAuth client allowing `https://cloud.openpencil.dev/api/auth/callback/google`, Email
  Routing sending from `cloud@openpencil.dev`, and the services Worker at
  `services.openpencil.dev` trusting this Cloud's keys.

Rooms' Durable Objects run in Cloudflare's EU jurisdiction (`production/worker.ts`); the database
and the bucket, which hold rooms' updates and snapshots, have to be in the EU too for the data to
stay there. An object named in a jurisdiction is a different object from one named outside it, so
a deployment never changes its jurisdiction while rooms are open.

## Deploying

Cloud is not released: it deploys from master whenever it needs to, a fix included, without a
release or the desktop builds a tag starts. Deploy staging, check it, then promote it:

```sh
gh workflow run deploy-cloud.yml --ref master -f target=staging
# once that run succeeded
gh workflow run deploy-cloud.yml --ref master -f target=production
```

Production deploys the commit of staging's newest deployment, whatever master is by then, and
refuses while that deployment is waiting, running, or failed, or while staging's Worker serves another commit, as after a rollback in Cloudflare, which GitHub does not record; deploy staging again then. A release deploys the same way, with
`--ref vX.Y.Z` for staging.

The environment's reviewers approve each run before it starts.

## Administrators

Deployment administrators approve sign-up requests and grant or revoke the role in the console
(`/admin`). For a target with no administrator who can sign in, `neonctl` logged in to the team's
Neon organization gives the admin command its database:

```sh
bun run cloud:admin production approve owner@example.com
# after that person signs in once
bun run cloud:admin production grant owner@example.com
```

The address never leaves the command's environment (`tools/ci/cloud-deploy/src/admin.ts`).

The workflow uploads the Worker's source maps, migrates the database over its direct connection,
deploys the Worker, and checks that `/health`, `/ready`, and the pages answer 200.

## Migrations: expand, then contract

Migrations run before the new Worker, so for a moment the previous release serves on the new
schema, and stays on it after a rollback. A migration therefore only adds: no table or column
dropped, renamed, retyped, or newly required, and a column it adds to an existing table is nullable
or has a default. `tests/integration/server/db/expand.test.ts` fails on anything else.

Removing or tightening something takes two releases. Dropping, renaming, or retyping waits for a
release after the last code that used it. Making a column required waits for a release whose code
writes it on every insert, then fills the rows that lack it in the same migration that requires it,
or gives it a default old code's inserts get. Either way the migration names it in `contracts` (see
`CloudMigration` in `src/server/db/migrate.ts`).

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
  "Deleted forever" filter. R2 keeps no versions, so the store copies each file it deletes under
  `deleted/` first (`deleted_prefix`), where the bucket's `expire-deleted` rule removes it after 14
  days on production and 7 on staging.
- **Rooms' Durable Objects:** an open room's document in memory, which they write back to the
  database and bucket.

To restore the database to an earlier time:

1. Take production off the air: run Deploy Cloud for `production` from master with
   **maintenance** checked. It redeploys the commit production serves, which each deploy tags its
   Worker version with, without waiting on staging. Every request then answers 503, the cron's cleanup does nothing, so
   nothing deletes what the restore brings back, and the rooms' objects refuse new sockets and
   close any open one that sends a message, so no edit reaches the database. It skips migrating
   and the health check. Wait five minutes after it finishes before restoring: Cloudflare may take
   that long to move a busy room's object onto the new version.
2. Create a Neon branch at the time before the damage, check it, and restore the production branch
   from it in the Neon console. Hyperdrive keeps the same connection.
3. Bring back the files the restored database uses that cleanup deleted since: for each file a
   revision (`document_revision`), an image (`workspace_image`, `revision_image`), or a room
   snapshot (`document_room_snapshot`) refers to, through its `storage_object` row's `object_key`,
   that the bucket lacks, copy `deleted/<object_key>` back to `<object_key>` with any S3 client
   against the bucket's endpoint. Other `storage_object` rows can name files never written, such
   as a snapshot whose upload failed; skip them. Files deleted more than 14 days ago are gone.
4. Put production back: run Deploy Cloud for `production` from master again without
   maintenance and with **redeploy** checked, which redeploys the commit production serves
   rather than waiting on staging. It migrates
   the restored database, so its schema matches the Worker even if the restore point predates a
   migration, deploys without the maintenance variable, and checks the pages answer. Its migrate
   step stops, and production stays in maintenance, when the restored database has run a migration
   the served commit does not know, as after a rollback in Cloudflare (see Rolling back). Compare
   `kysely_migration` with the migrations in `src/server/db/migrate.ts` at that commit first; if
   the database is ahead, leave **redeploy** unchecked to promote what staging runs instead, once
   staging runs a commit that knows them.
5. Open a document saved before the restore point.

## Restore drill

Once a quarter, and after changing the database's provider or plan:

1. Two weeks before, save a throwaway document in a team workspace on production, then delete it
   forever. Cleanup destroys its files when the 7-day grace ends, copying them under `deleted/`.
2. On the drill's day, about six days after that cleanup run, create a Neon branch of production at
   an hour before it. That is near the end of the restore window, so the copies are about as old
   as any a restore can need, and the branch still has the document's `storage_object` rows.
3. Check the branch's `kysely_migration` table names the latest migration in
   `src/server/db/migrate.ts` that production has run.
4. For that document and a few others saved before the branch's time, check that every file their
   revisions, images, and room snapshots refer to (by `storage_object.object_key`) is in the
   production bucket, under its key or under `deleted/`. The throwaway document's revision files
   must be under `deleted/` only: that is what step 3 of a restore copies back. An image it shared
   with another document stays under its key.
5. Delete the branch, and note the date, the time the restore took, and anything that failed in the
   team's drill log.
