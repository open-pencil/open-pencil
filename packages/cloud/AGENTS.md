# Cloud

Optional, self-hostable backend; the design is in `packages/docs/development/cloud.md`. The editor must keep opening, editing, and saving local documents without this package or a network.

## Boundaries

- Consumers import the `contract`, `client`, `email`, `server`, and `runtime/node` subpaths; browser code imports only `contract` and `client`, which stay on the browser baseline (`tests/app/shell/support/baseline.test.ts`, `compat/compat` in `oxlint.json`).
- `src/server` receives its database, object store, auth adapter, and delivery through injection and never imports `pg`, opens listeners, runs migrations, or starts timers; runtimes under `src/runtime/` own those (`src/runtime/node/server.ts`).
- The package is published to npm; a directory imported as `#cloud/<dir>` is listed in `imports` in `package.json`, since the wildcard there names `.ts` files (`bun run check:packages`).
- `@better-auth/core` is pinned to the `better-auth` version though nothing imports it: `@better-auth/passkey` accepts any later core, whose exact `@better-fetch/fetch` differs from its own, and npm then never finishes installing the package (`bun run test:packages`).
- Errors no route handled, and failures of work a runtime owns, go through `reportCloudError` with the injected `CloudErrorReporter`; only runtimes create one, from the optional `[error_tracking]` table, so a deployment without it sends nothing (`src/runtime/posthog/errors.ts`, `tests/server/errors/handler.test.ts`).
- Runtime code runs on Node 22 and Bun alike: serve HTTP through `@hono/node-server`, not `Bun.serve` or other `Bun.*` APIs (`tsdown.standalone.config.ts` targets `node22`).

## Data and security

- Sign-ins are recorded by the `accountActivity` Better Auth plugin from the hook context's `newSession`, never by parsing tokens from responses (`src/server/auth/activity.ts`).
- Code inside Better Auth's callbacks that run in its transaction, such as database hooks and `sendVerificationEmail`, must not query the database, which deadlocks on one connection; `user.deleteUser.beforeDelete` runs outside one, so account deletion queries there (`tests/integration/server/account/routes.test.ts`, `tests/integration/server/account/deletion.test.ts`).
- Name a table for what it holds, without a `cloud_` prefix; only a name Better Auth already uses gets a qualifier, such as `api_rate_limit`. Name keys, checks, and indexes as PostgreSQL does: `<table>_pkey`, `<table>_<columns>_key`, `<table>_<columns>_fkey`, `<table>_<column>_check`, and `<table>_<columns>_idx` (`tests/integration/server/db/baseline.test.ts`).
- `user.image` only ever holds an address this server serves; a picture from anywhere else is copied into `user_picture` or dropped, never linked, and a provider's picture comes from the ID token on its account row, never from the endpoint that wrote it (`src/server/pictures/provider.ts`, `tests/integration/server/pictures/provider.test.ts`).
- Name a Better Auth endpoint by the object that declares it: a plugin's from the plugin the factory builds, a core one from `auth.api`; only the core paths options need before Better Auth is built are written out, in `CORE_AUTH_PATHS`, where the type check holds them to the library's own. Match hook paths with `isAuthEndpoint`, and put endpoints clients must not reach in `disabledPaths` (`src/server/auth/factory.ts`, `src/server/auth/endpoints.ts`).
- A route with a rate budget of its own mounts `createRouteRateLimiter`, or `createResourceRateLimiter` for a budget per resource, whose policy also caps the actor across resources; general limiters skip what either counts through `routeHasOwnBudget`, so never exempt routes by matching their paths (`tests/integration/server/rate-limit/budgets.test.ts`).
- Database rows use `crypto.randomUUID()`; secrets that leave the server use `randomHex` from `@open-pencil/scene-graph/random`, are stored as SHA-256 digests (a single-use OAuth continuation keeps a JWE copy), and travel in URL fragments (`src/server/sharing/capabilities/service.ts`).
- An admin list takes `search`, `filter`, `limit`, and `offset` through `listQuery` and answers with its rows, `total`, and per-filter `counts`; it declares its filters once as `ListFilters`, which count in one query and page with the same condition (`src/admin/list.ts`, `tests/integration/admin/lists.test.ts`).
- Every HTTP body goes through `validatedJSON` with a contract schema, and every response the client reads is parsed with Valibot (`src/server/validation.ts`, `src/client/api.ts`).
- Every route parameter goes through a `validatedParams` validator such as `documentParams`, and handlers read it from `context.req.valid('param')`; a malformed UUID then answers 404 instead of reaching a query (`@open-pencil/security/no-unvalidated-route-params`, `tests/integration/server/api/uuid-parameters.test.ts`).
- A table that refers to a `storage_object` row is named in `unreferencedObject`, which decides what the object sweep may delete; a collaboration room's snapshot is such a file (`src/server/cleanup/objects.ts`, `tests/integration/server/collaboration/persistence.test.ts`).
- A revision's images live in `revision_image`; code that makes a revision from another copies them with `copyRevisionImages`, and a storage object a `workspace_image` holds is never unreferenced (`src/server/documents/images.ts`, `tests/integration/server/documents/images.test.ts`).
- Add schema changes as a new numbered migration in `src/server/db/migrations/`, after the six domain migrations the schema starts from (`001_accounts` to `006_operations`) and built with `migrations/schema.ts`, registered in `src/server/db/migrate.ts`; never edit a migration that has shipped. Better Auth builds its own tables after Cloud's, once, and `auth_schema_version` records the version they were built for (`migrateCloudDatabase`, `tests/integration/server/db/auth-schema.test.ts`).
- Raw SQL lives only in migrations and the reviewed helpers in `src/server/db/expressions.ts`; everything else uses typed Kysely queries (`open-pencil/no-cloud-raw-sql`).
- Cloud code keeps secrets out of query strings and logs, and the server never builds an HTML response from values (`@open-pencil/security/no-secret-in-query`, `@open-pencil/security/no-secret-logging`, `@open-pencil/security/no-dynamic-html`).

## Collaboration relay

- The relay hub in `src/server/collaboration/relay/` is runtime-neutral: runtimes hand it sockets through `RelaySocket` and own listening (`src/runtime/node/relay.ts`). It joins every room as the `server` peer, so it must keep answering `sync-step1` and saving the room document.
- Viewers may send only the channels in `VIEWER_ACTIONS`; every other channel from them is dropped, and presence is stamped from the ticket by `stampAwareness` (`tests/server/collaboration/relay/hub.test.ts`).
- Decoders must consume exactly the frame's bytes and copy payloads out, since socket buffers are pooled (`src/contract/relay.ts`, `tests/contract/relay.test.ts`).
- Send frames through `relayServerMessages` and `relayClientMessages`, which split anything past `RELAY_FRAGMENT_BYTES` into fragments, and read sockets through the matching assemblers; never send an encoded frame whole (`tests/server/collaboration/relay/hub.test.ts`).
- The relay keeps no timer while its sockets are idle, so a Durable Object can hibernate: a ticket's expiry is checked when the relay hears from or sends to the peer, a peer's state rides on its socket through `RelaySocket.remember` and comes back with `resume`, and a resumed room loads its document only when a message needs it (`tests/server/collaboration/relay/resume.test.ts`).
- On Cloudflare, every socket event goes through `createRelaySockets`, which wakes the relay and resumes the socket's peer first, since a close can be the first event after hibernation; a room closing after a wake still folds its log into a snapshot (`tests/runtime/cloudflare/relay/sockets.test.ts`, `tests/server/collaboration/relay/resume.test.ts`).
- The heartbeat is the only text on a relay socket: a runtime answers `RELAY_HEARTBEAT.ping` with `pong` before the hub sees it, the Durable Object through `setWebSocketAutoResponse` so a ping never wakes it. Editors ping only a relay whose tickets set `relayHeartbeat`, since an older relay turns a ping away as a malformed frame (`tests/runtime/node/relay.test.ts`, `tests/e2e/cloudflare/checks.ts`).

## Services server

- The reference services server in `src/services/` implements the chat part of the services contract. It is runtime-neutral like `src/server`; runtimes own listening and keys (`src/runtime/node/services/server.ts`).
- It speaks only the contract in `src/contract/services.ts` (`tests/contract/services.test.ts`).
- It trusts nothing about a request beyond a token that verifies against Cloud's keys (`tests/integration/services/app.test.ts`).
- It forwards only the chat completion fields in `FORWARDED_FIELDS`, so routing fields cannot reach models outside the catalog (`tests/integration/services/app.test.ts`).
- Its tables are `services_*` with their own migration history (`services_migration`), so it can share Cloud's database (`src/services/db/migrate.ts`).
- Neither the services server nor Cloud reads the other's tables (`src/services/db/schema.ts`).

## Portal

- The portal's pages live in the app (`cloud.html`, `src/views/cloud/`, `src/components/cloud-portal/`); this package owns only their paths (`src/contract/portal.ts`) and serving them beside the editor (`src/runtime/site/server.ts`). Links the server sends to people point at `publicURL`, its editor and portal alike (`src/contract/links.ts`, `src/admin/enrollment/email.ts`).

## Configuration

- Deployment settings live in the schema-versioned TOML parsed by `src/server/config/deployment.ts`; environment variables only resolve `{ from_env }` secret references and never override the file (`tests/runtime/node/config.test.ts`).
- Technical limits are ceilings that policy can tighten but never raise (`src/server/config/limits.ts`, `src/server/policy/`).
- Feature and limit decisions go through the OpenFeature policy keys in `src/server/policy/keys.ts`; never branch on a plan name.
- Plans belong to accounts: ask a workspace's or document's policy through `workspacePolicyContext`, which targets the workspace owner, never with the workspace as the target, so creating workspaces adds no allowance (`tests/integration/server/policy/service.test.ts`, `tests/integration/server/quota/storage.test.ts`).

## Tests

- Unit tests mirror `src` under `tests/{client,contract,email,runtime,server,services}`; integration tests mirror `src` under `tests/integration` and run on PGlite through `tests/helpers/database.ts`; `tests/e2e` holds Docker Compose runners that `test` never starts.
- Tests import source through `#cloud/*` and helpers through `#cloud-tests/*`, and read responses with `responseJSON` from `tests/helpers/response.ts`.
- `bun run test:cloud` type-checks the package and runs unit and integration suites.
