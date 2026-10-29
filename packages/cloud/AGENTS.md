# Cloud

Optional, self-hostable backend; the design is in `packages/docs/development/cloud.md`. The editor must keep opening, editing, and saving local documents without this package or a network.

## Boundaries

- Consumers import the `contract`, `client`, `email`, `server`, and `runtime/node` subpaths; browser code imports only `contract` and `client`, which stay on the browser baseline (`tests/app/shell/support/baseline.test.ts`, `compat/compat` in `oxlint.json`).
- `src/server` receives its database, object store, auth adapter, and delivery through injection and never imports `pg`, opens listeners, runs migrations, or starts timers; runtimes under `src/runtime/` own those (`src/runtime/node/server.ts`).
- The package is published to npm; a directory imported as `#cloud/<dir>` is listed in `imports` in `package.json`, since the wildcard there names `.ts` files (`bun run check:packages`).
- `@better-auth/core` is pinned to the `better-auth` version though nothing imports it: `@better-auth/passkey` accepts any later core, whose exact `@better-fetch/fetch` differs from its own, and npm then never finishes installing the package (`bun run test:packages`).
- Runtime code runs on Node 22 and Bun alike: serve HTTP through `@hono/node-server`, not `Bun.serve` or other `Bun.*` APIs (`tsdown.standalone.config.ts` targets `node22`).

## Data and security

- Sign-ins are recorded by the `accountActivity` Better Auth plugin from the hook context's `newSession`, never by parsing tokens from responses (`src/server/auth/activity.ts`).
- Code inside Better Auth's own callbacks must not query the database, which deadlocks its transaction on one connection (`tests/integration/server/account/routes.test.ts`).
- Name a table for what it holds, without a `cloud_` prefix; only a name Better Auth already uses gets a qualifier, such as `api_rate_limit` (`src/server/db/migrations/025_table_names.ts`).
- Renaming a table that shipped migrations query gives them a type under the name they ran with, so their SQL stays the same (`LegacyAuthSchemaDatabase` in `src/server/db/migrations/helpers.ts`).
- `user.image` only ever holds an address this server serves; a picture from anywhere else is copied into `user_picture` or dropped, never linked, and a provider's picture comes from the ID token on its account row, never from the endpoint that wrote it (`src/server/pictures/provider.ts`, `tests/integration/server/pictures/provider.test.ts`).
- Name a Better Auth endpoint by the object that declares it: a plugin's from the plugin the factory builds, a core one from `auth.api`; only the core paths options need before Better Auth is built are written out, in `CORE_AUTH_PATHS`, where the type check holds them to the library's own. Match hook paths with `isAuthEndpoint`, and put endpoints clients must not reach in `disabledPaths` (`src/server/auth/factory.ts`, `src/server/auth/endpoints.ts`).
- A route with a rate budget of its own mounts `createRouteRateLimiter`, and general limiters skip what it counts through `routeHasOwnBudget`; never exempt routes by matching their paths (`tests/integration/server/rate-limit/budgets.test.ts`).
- Database rows use `crypto.randomUUID()`; secrets that leave the server use `randomHex` from `@open-pencil/scene-graph/random`, are stored as SHA-256 digests (a single-use OAuth continuation keeps a JWE copy), and travel in URL fragments (`src/server/sharing/capabilities/service.ts`).
- An admin list takes `search`, `filter`, `limit`, and `offset` through `listQuery` and answers with its rows, `total`, and per-filter `counts`; it declares its filters once as `ListFilters`, which count in one query and page with the same condition (`src/admin/list.ts`, `tests/integration/admin/lists.test.ts`).
- Every HTTP body goes through `validatedJSON` with a contract schema, and every response the client reads is parsed with Valibot (`src/server/validation.ts`, `src/client/api.ts`).
- A revision's images live in `revision_image`; code that makes a revision from another copies them with `copyRevisionImages`, and a storage object a `workspace_image` holds is never unreferenced (`src/server/documents/images.ts`, `tests/integration/server/documents/images.test.ts`).
- Add schema changes as a new numbered migration in `src/server/db/migrations/` registered in `src/server/db/migrate.ts`; never edit a migration that has shipped. Better Auth's tables have their own versioned migration (`016_auth_schema.ts`).
- Raw SQL lives only in migrations and the reviewed helpers in `src/server/db/expressions.ts`; everything else uses typed Kysely queries (`open-pencil/no-cloud-raw-sql`).
- Cloud code keeps secrets out of query strings and logs, and the server never builds an HTML response from values (`open-pencil/no-cloud-secret-in-query`, `open-pencil/no-cloud-secret-logging`, `open-pencil/no-cloud-dynamic-html`).

## Collaboration relay

- The relay hub in `src/server/collaboration/relay/` is runtime-neutral: runtimes hand it sockets through `RelaySocket` and own listening (`src/runtime/node/relay.ts`). It joins every room as the `server` peer, so it must keep answering `sync-step1` and saving the room document.
- Viewers may send only the channels in `VIEWER_ACTIONS`; every other channel from them is dropped, and presence is stamped from the ticket by `stampAwareness` (`tests/server/collaboration/relay/hub.test.ts`).
- Decoders must consume exactly the frame's bytes and copy payloads out, since socket buffers are pooled (`src/contract/relay.ts`, `tests/contract/relay.test.ts`).
- Send frames through `relayServerMessages` and `relayClientMessages`, which split anything past `RELAY_FRAGMENT_BYTES` into fragments, and read sockets through the matching assemblers; never send an encoded frame whole (`tests/server/collaboration/relay/hub.test.ts`).

## AI relay

- The reference AI service in `src/ai-relay/` is runtime-neutral like `src/server`; runtimes own listening and keys (`src/runtime/node/ai-relay/server.ts`).
- It speaks only the contract in `src/contract/ai.ts` (`tests/contract/ai.test.ts`).
- It trusts nothing about a request beyond a token that verifies against Cloud's keys (`tests/integration/ai-relay/app.test.ts`).
- It forwards only the chat completion fields in `FORWARDED_FIELDS`, so routing fields cannot reach models outside the catalog (`tests/integration/ai-relay/app.test.ts`).
- The relay's tables are `ai_relay_*` with their own migration history, so it can share Cloud's database (`src/ai-relay/db/migrate.ts`).
- Neither the relay nor Cloud reads the other's tables (`src/ai-relay/db/schema.ts`).

## Portal

- The portal's pages live in the app (`cloud.html`, `src/views/cloud/`, `src/components/cloud-portal/`); this package owns only their paths (`src/contract/portal.ts`) and serving them beside the editor (`src/runtime/site/server.ts`). Links the server sends to people point at `publicURL`, its editor and portal alike (`src/contract/links.ts`, `src/admin/enrollment/email.ts`).

## Configuration

- Deployment settings live in the schema-versioned TOML parsed by `src/server/config/deployment.ts`; environment variables only resolve `{ from_env }` secret references and never override the file (`tests/runtime/node/config.test.ts`).
- Technical limits are ceilings that policy can tighten but never raise (`src/server/config/limits.ts`, `src/server/policy/`).
- Feature and limit decisions go through the OpenFeature policy keys in `src/server/policy/keys.ts`; never branch on a plan name.

## Tests

- Unit tests mirror `src` under `tests/{ai-relay,client,contract,email,runtime,server}`; integration tests mirror `src` under `tests/integration` and run on PGlite through `tests/helpers/database.ts`; `tests/e2e` holds Docker Compose runners that `test` never starts.
- Tests import source through `#cloud/*` and helpers through `#cloud-tests/*`, and read responses with `responseJSON` from `tests/helpers/response.ts`.
- `bun run test:cloud` type-checks the package and runs unit and integration suites.
