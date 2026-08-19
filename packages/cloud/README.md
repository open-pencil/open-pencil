# @open-pencil/cloud

Optional, self-hostable OpenPencil Cloud services. This package owns the portable API contracts,
client, authentication and authorization services, PostgreSQL metadata, S3-compatible object
storage integration, sharing, and Cloud collaboration runtime adapters.

Cloud is an optional extension of OpenPencil's local-first editor. Opening, editing, and saving local
documents must continue to work without this package, a network connection, or an account.

## Public package boundaries

Use explicit subpath exports:

- `@open-pencil/cloud/contract` — Valibot network contracts and public types.
- `@open-pencil/cloud/client` — discovery, authentication, and typed Hono RPC clients.
- `@open-pencil/cloud/email` — Vue Email template rendering.
- `@open-pencil/cloud/server` — portable Hono services and runtime-neutral policy.
- `@open-pencil/cloud/runtime/node` — PostgreSQL, S3, SMTP, Hocuspocus, listeners, and workers.
- `@open-pencil/cloud/runtime/cloudflare` — Workers/Hyperdrive/R2 assembly.

The portable server receives its database, object store, delivery, and session dependencies through
injection. It does not import `pg`, start listeners, run migrations, or start background workers.
Serverless request handlers remain stateless; migrations and cleanup are explicit commands or
scheduled jobs.

## Document model

PostgreSQL stores workspace, access, document, revision, upload, sharing, and collaboration metadata.
S3-compatible storage stores immutable `.fig` objects. A document points to a current immutable
revision; each revision points to a distinct object key.

- SHA-256 verifies document integrity. S3 ETags are used only where required for multipart
  completion.
- Optimistic ancestry detects stale revisions through `baseRevisionId` and `parentRevisionId`.
- Conflicts require an explicit choice: use the Cloud revision, keep both, or replace the Cloud
  revision.
- Yjs live state never merges independently edited `.fig` snapshots.
- Logical deletion is immediate. Physical revision and object deletion follows retention policy.

## Local-first integration

The app integrates Cloud through the existing local cache, outbox, and storage adapter model. Local
bytes remain available offline, remote ancestry is persisted locally, and synchronization retries do
not block editing. Cloud, direct S3/BYOS, and local documents remain distinct document modes.

## Authentication and identities

Better Auth owns user sessions and social sign-in persistence. OpenPencil owns workspace and document
authorization.

Persistent database entities use UUIDs. Public opaque values such as capability secrets, invitation
tokens, guest IDs, and OAuth continuations use Nano ID. Raw sharing and invitation secrets are never
stored; PostgreSQL stores SHA-256 digests.

Collaboration principals are either authenticated users or stable guests. Signed Cloud tickets are the
authoritative source for presence identity and permissions. Clients cannot replace a Cloud principal
with an arbitrary local display name.

## Sharing and permissions

Document access may come from:

- ownership,
- workspace membership,
- a direct user grant,
- a capability link.

The strongest available permission wins. Revoking one source does not remove access inherited from
another source.

Capability and invitation secrets are placed in URL fragments so they do not enter HTTP access logs or
referrer headers. The app removes the fragment before making network requests. Hash-only links are
shown only at creation or rotation.

Anonymous access is not a single boolean. Runtime policy must distinguish capability links, anonymous
viewing, anonymous editing, guest presence, guest export, and guest participant limits. Deployment,
plan, workspace, and document policy can each restrict access; a lower layer cannot enable a feature
forbidden by a higher layer.

## Live collaboration

Yjs owns the shared document and update format. `y-protocols` owns document synchronization and
awareness. OpenPencil does not define a custom synchronization protocol.

Temporary local and direct-S3 collaboration uses Trystero and advertises:

```ts
serverEnforcedWrites: false
```

Cloud deployments can configure a Hocuspocus WebSocket relay. Hocuspocus provides authentication,
readonly connections, token synchronization, awareness, reconnection, and Yjs protocol handling. The
relay validates signed epoch-scoped tickets, marks viewers read-only, and stamps awareness with
server-verified metadata. Relay-backed tickets advertise:

```ts
serverEnforcedWrites: true
```

Live Yjs state is stored in PostgreSQL by document and collaboration epoch through Hocuspocus's
official database extension. Cloud sessions do not add browser IndexedDB room persistence; PostgreSQL
is authoritative for relay state. Local and direct-S3 sessions may still use IndexedDB alongside
Trystero. Live state remains separate from immutable `.fig` revisions and object storage. Capability
secret rotation preserves the active epoch, while revocation advances it to isolate future sessions.

## Configuration ownership

Cloud configuration has separate layers. Do not move mutable product policy into environment
variables or static deployment configuration.

### Environment variables and platform bindings

Environment variables are limited to values required before the deployment configuration or database
can be loaded:

- the deployment config path,
- secret material,
- platform-provided bindings and workload identity,
- rare bootstrap selectors such as an instance environment name.

Examples include `OPENPENCIL_CLOUD_CONFIG`, `DATABASE_URL`, authentication signing secrets, object
storage credentials, OAuth client secrets, and billing webhook secrets. Platform adapters may receive
Hyperdrive, R2, Durable Object, or workload-identity bindings directly instead of process environment
variables.

A value does not belong in the environment when a workspace administrator, billing event, support
operation, or feature rollout must change it without redeployment.

### TOML deployment configuration

The canonical operator-authored configuration format is TOML:

```text
openpencil-cloud.toml
```

TOML was chosen over YAML because it is explicit, comment-friendly, less ambiguous, and familiar to
the Rust/Tauri side of the project. The file must include `schema_version`. It uses conventional
`snake_case`; validated TypeScript configuration uses camelCase.

Deployment configuration owns static infrastructure topology and technical safety ceilings:

- public API and app origins,
- listeners, ports, proxy behavior, and trusted origins,
- database pool configuration,
- object storage endpoint and adapter selection,
- authentication provider enablement and secret references,
- collaboration provider and listener configuration,
- email transport selection,
- cleanup scheduling,
- observability exporters,
- maximum technically supported request, upload, message, multipart, and connection sizes.

Production secrets are referenced by environment variable, platform binding, or mounted secret file;
they are not embedded directly in TOML. Syntax parsing and semantic validation are separate: a
maintained TOML parser handles TOML, then Valibot validates and normalizes the complete document.

Technical ceilings protect runtime stability and are not customer entitlements. Runtime policy may
set stricter values but cannot exceed these ceilings.

### PostgreSQL runtime policy

PostgreSQL is the canonical source for mutable product and business policy:

- versioned plan definitions,
- subscriptions and billing subjects,
- workspace plan assignments,
- workspace policy overrides,
- temporary or promotional entitlement grants,
- document sharing policy,
- usage ledgers,
- quota reservations,
- policy audit history.

Plan IDs are opaque strings and must not appear in product branching logic. Code asks for concrete
feature or resource decisions rather than checking whether a workspace is on a plan named `pro`.
Plan versions are immutable once assigned so historical subscriptions and grandfathered behavior
remain explainable.

Policy documents may use validated `jsonb` where policy evolution would otherwise produce many
nullable columns. Every policy document is parsed with a versioned Valibot schema before use.

### OpenFeature evaluation

OpenFeature is the application-facing API for dynamic feature and entitlement decisions. A database-
backed provider resolves deployment capability, plan version, subscription state, temporary grants,
workspace restrictions, and document policy into concrete values.

Typical feature keys include:

```text
cloud.sharing.capability-links
cloud.sharing.anonymous-view
cloud.sharing.anonymous-edit
cloud.sharing.guest-presence
cloud.collaboration.enabled
cloud.collaboration.server-enforced-writes
cloud.documents.revision-history
```

Evaluation context carries stable IDs such as actor, workspace, organization, and document. It must
not include secrets or unnecessary personal data. Evaluations have safe defaults and expose reasons
for auditing and observability.

OpenFeature evaluates availability and configured limits. It is not the usage ledger and does not
provide transactional resource reservations.

## Plans, billing subjects, and quotas

A workspace is the initial resource container. Billing ownership is separate so personal workspaces
can belong to a user billing subject, team workspaces to an organization, and self-hosted workspaces
to a deployment/default subject.

Effective policy is layered:

1. technical deployment ceiling,
2. deployment capability,
3. versioned plan entitlement,
4. subscription additions,
5. temporary entitlement grants,
6. workspace restrictions,
7. document policy.

Boolean capabilities require all applicable parent layers to allow them. Numeric maxima use the most
restrictive non-null limit. Retention keys must define whether they represent a minimum or maximum
before merge behavior is implemented.

Measured resources require a transactional quota service. Storage enforcement uses reservations:

1. resolve the effective entitlement,
2. lock the quota account in PostgreSQL,
3. include committed usage and active reservations,
4. reserve the requested bytes,
5. create the upload session,
6. commit actual verified usage,
7. release the reservation after abort or expiration.

This prevents concurrent uploads from independently passing the same usage check. Upload cleanup must
release abandoned reservations. Candidate resources include storage bytes, document count, active
uploads, revisions, collaboration participants, editors, and anonymous guests.

## Self-hosting

Self-hosting does not require an external billing provider. A no-billing adapter can assign a default
plan or static subscription. TOML may reference an explicit bootstrap policy file, but bootstrap data
is imported into PostgreSQL only through initialization or an administrative command. Startup must
not silently overwrite administrator changes.

Deployment instructions live under [`deploy/`](./deploy/README.md). Security hardening lives in
[`deploy/security.md`](./deploy/security.md), and serverless constraints live in
[`deploy/serverless.md`](./deploy/serverless.md).

## Security properties and limitations

- Private-resource lookups are non-enumerating.
- Every network boundary is validated.
- Capability comparisons use constant-time digest comparison.
- Invitation OAuth continuation tokens use compact JWE and are single-use.
- Viewer enforcement is authoritative only on the Cloud relay; Trystero remains client-enforced.
- Serverless handlers do not migrate databases or run background timers.
- Presigned object transfers are distinct from authenticated API transport.
- Technical ceilings remain effective even if billing or policy data is misconfigured.

## Open questions

The following policy details require product decisions before schema implementation:

- initial official plan catalogue and versioning cadence,
- storage accounting subject for shared or duplicated objects,
- personal versus organization billing-subject lifecycle,
- revision-retention merge semantics,
- collaboration participant reservation versus relay-local enforcement,
- policy administration and audit UI,
- billing provider selection and webhook model,
- default anonymous-access policy for official and self-hosted deployments.
