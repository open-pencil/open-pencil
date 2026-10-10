# @open-pencil/cloud

Optional, self-hostable OpenPencil Cloud: accounts, workspaces, immutable document revisions in
S3-compatible storage, sharing, enrollment, quotas, and transactional email. The editor stays
local-first and works without it.

## Subpaths

- `@open-pencil/cloud/contract` — Valibot network contracts and public types.
- `@open-pencil/cloud/client` — discovery, authentication, device authorization, and the typed client.
- `@open-pencil/cloud/email` — Vue Email rendering.
- `@open-pencil/cloud/server` — runtime-neutral Hono routes and services with injected dependencies.
- `@open-pencil/cloud/runtime/node` — PostgreSQL, S3, SMTP, the HTTP listener, and workers.

## Running

The Node runtime reads one deployment TOML file named by `OPENPENCIL_CLOUD_CONFIG` and resolves
secrets from the environment. Start from
[`deploy/openpencil-cloud.example.toml`](./deploy/openpencil-cloud.example.toml), then build and run
the self-contained server on Node 22 or later:

```sh
bun --filter @open-pencil/cloud build:standalone
bun --filter @open-pencil/cloud start
```

The server migrates the database before it accepts requests. [`deploy/README.md`](./deploy/README.md)
covers self-hosting, local development, and operator commands, and
[`deploy/security.md`](./deploy/security.md) covers hardening. The design is described in
[Cloud Architecture](https://openpencil.dev/development/cloud).

## Tests

`bun run test:cloud` from the repository root type-checks the package and runs unit and PGlite
integration tests. `bun --filter @open-pencil/cloud test:e2e` runs the Docker Compose end-to-end
suite against PostgreSQL and SeaweedFS.
