# @lawha/cloud

Optional, self-hostable Lawha Cloud: accounts, workspaces, immutable document revisions in
S3-compatible storage, sharing, enrollment, quotas, and transactional email. The editor stays
local-first and works without it.

## Subpaths

- `@lawha/cloud/contract` — Valibot network contracts and public types.
- `@lawha/cloud/client` — discovery, authentication, device authorization, and the typed client.
- `@lawha/cloud/email` — Vue Email rendering.
- `@lawha/cloud/server` — runtime-neutral Hono routes and services with injected dependencies.
- `@lawha/cloud/runtime/node` — PostgreSQL, S3, SMTP, the HTTP listener, and workers.

## Running

The Node runtime reads one deployment TOML file named by `LAWHA_CLOUD_CONFIG` and resolves
secrets from the environment. Start from
[`deploy/lawha-cloud.example.toml`](./deploy/lawha-cloud.example.toml), then build and run
the server on Node 22 or later, installed from npm or built from a checkout:

```sh
npx -p @lawha/cloud lawha-cloud   # lawha-ai-relay runs the AI relay
bun --filter @lawha/cloud build:standalone && bun --filter @lawha/cloud start
```

The server migrates the database before it accepts requests. The
[self-hosting guide](https://github.com/aliaaldihnayn-lab/design#readme) covers building with the
portal, configuration, the editor address, operator commands, and upgrades;
[`deploy/README.md`](./deploy/README.md) covers local development and end-to-end tests, and
[`deploy/security.md`](./deploy/security.md) covers hardening. The design is described in
[Cloud Architecture](https://github.com/aliaaldihnayn-lab/design#readme).

## Tests

`bun run test:cloud` from the repository root type-checks the package and runs unit and PGlite
integration tests. `bun --filter @lawha/cloud test:e2e` runs the Docker Compose end-to-end
suite against PostgreSQL and SeaweedFS.
