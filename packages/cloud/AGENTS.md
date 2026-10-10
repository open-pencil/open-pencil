# Cloud

Optional, self-hostable backend; the design is in `packages/docs/development/cloud.md`. The editor must keep opening, editing, and saving local documents without this package or a network.

## Boundaries

- Consumers import the `contract`, `client`, `email`, `server`, and `runtime/node` subpaths; browser code imports only `contract` and `client`, which stay on the browser baseline (`tests/app/shell/support/baseline.test.ts`, `compat/compat` in `oxlint.json`).
- `src/server` receives its database, object store, auth adapter, and delivery through injection and never imports `pg`, opens listeners, runs migrations, or starts timers; runtimes under `src/runtime/` own those (`src/runtime/node/server.ts`).
- Runtime code runs on Node 22 and Bun alike: serve HTTP through `@hono/node-server`, not `Bun.serve` or other `Bun.*` APIs (`tsdown.standalone.config.ts` targets `node22`).

## Data and security

- Database rows use `crypto.randomUUID()`; secrets that leave the server use `randomHex` from `@open-pencil/scene-graph/random`, are stored as SHA-256 digests (a single-use OAuth continuation keeps a JWE copy), and travel in URL fragments (`src/server/sharing/capabilities/service.ts`).
- Every HTTP body goes through `validatedJSON` with a contract schema, and every response the client reads is parsed with Valibot (`src/server/validation.ts`, `src/client/api.ts`).
- Add schema changes as a new numbered migration in `src/server/db/migrations/` registered in `src/server/db/migrate.ts`; never edit a migration that has shipped. Better Auth's tables have their own versioned migration (`016_auth_schema.ts`).
- Prefer typed Kysely queries; raw SQL goes through the reviewed helpers in `src/server/db/expressions.ts`.

## Configuration

- Deployment settings live in the schema-versioned TOML parsed by `src/server/config/deployment.ts`; environment variables only resolve `{ from_env }` secret references and never override the file (`tests/runtime/node/config.test.ts`).
- Technical limits are ceilings that policy can tighten but never raise (`src/server/config/limits.ts`, `src/server/policy/`).
- Feature and limit decisions go through the OpenFeature policy keys in `src/server/policy/keys.ts`; never branch on a plan name.

## Tests

- Unit tests mirror `src` under `tests/{client,contract,runtime,server}`; integration tests mirror `src` under `tests/integration` and run on PGlite through `tests/helpers/database.ts`; `tests/e2e` holds Docker Compose runners that `test` never starts.
- Tests import source through `#cloud/*` and helpers through `#cloud-tests/*`, and read responses with `responseJSON` from `tests/helpers/response.ts`.
- `bun run test:cloud` type-checks the package and runs unit and integration suites.
