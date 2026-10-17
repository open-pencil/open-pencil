# Cloud Architecture

OpenPencil Cloud is an optional, self-hostable backend for storing, sharing, and collaborating on
documents. The editor stays local-first: opening, editing, and saving local files never needs this
package, a network connection, or an account.

`@open-pencil/cloud` holds the network contracts, a typed client, a runtime-neutral Hono server, and
the Node runtime that wires PostgreSQL, S3-compatible storage, SMTP, and background workers into it.

```mermaid
flowchart LR
  Editor[Editor and desktop app] -->|typed client| API[Hono server]
  API --> Auth[Better Auth sessions]
  API --> Policy[OpenFeature policy]
  API --> PG[(PostgreSQL metadata)]
  API -->|presigned URLs| S3[(S3-compatible objects)]
  Editor -->|presigned PUT and GET| S3
  Workers[Cleanup and email workers] --> PG
  Workers --> S3
  Workers --> SMTP[SMTP]
```

## Package boundaries

| Subpath                           | Contents                                                                   |
| --------------------------------- | -------------------------------------------------------------------------- |
| `@open-pencil/cloud/contract`     | Valibot schemas and types shared by every side of the network              |
| `@open-pencil/cloud/client`       | Discovery, authentication, device authorization, and the typed Hono client |
| `@open-pencil/cloud/email`        | Vue Email rendering for transactional mail                                 |
| `@open-pencil/cloud/server`       | Hono routes and services; every dependency is injected                     |
| `@open-pencil/cloud/runtime/node` | PostgreSQL, S3, SMTP, the HTTP listener, workers, and operator commands    |

The server never imports `pg`, opens a listener, runs migrations, or starts timers; runtimes do.
Browser code imports only `contract` and `client`, so it never pulls in server dependencies.

## Documents and revisions

PostgreSQL stores workspaces, membership, documents, revisions, uploads, sharing, and quota state.
Object storage stores immutable `.fig` revisions; a document points at its current revision, and every
revision has its own object key.

- Uploads go straight from the client to object storage through presigned single or multipart PUTs.
  The server verifies a SHA-256 digest before committing; ETags only complete multipart uploads.
- Each upload names the revision it was based on, so a stale base is rejected instead of silently
  overwriting a newer revision. The client then chooses: take the Cloud revision, keep both, or
  replace it.
- Deleting a document is immediate for users; the cleanup worker removes revisions and objects once
  the retention period passes.

### Version history

Every save is a revision, but the history a person sees is its versions: checkpoints the server
keeps on its own, and versions someone named (`document_version`, one per revision).

- When a save lands and the newest version is half an hour old, the server keeps the revision that
  save replaces as a checkpoint, so each stretch of editing and the state every session ended on stay
  in the history. A document's first save is always one.
- Naming the current state, or naming any version, makes it a named version; deleting its info turns
  it back into a checkpoint. Viewers see the history; editors name, restore, and duplicate.
- Restoring keeps the replaced state as a checkpoint, adds a revision that points at the restored
  version's stored file, and advances the collaboration epoch, so the live room starts over on it.
  Duplicating makes a new document in the same workspace from the same file. Neither uploads
  anything or uses more storage.
- The cleanup worker compacts saves that are neither current nor a version once they are a day old,
  a batch at a time, and returns the bytes of files nothing else uses to the workspace's usage. A
  freed file's row stays until the object store deletes it, so a failed delete is retried. With
  the `revision_history` entitlement off, a workspace keeps 30 days of versions, as on a free plan.

## Authentication and authorization

Better Auth owns users, sessions, social sign-in, email and password, passkeys, TOTP, and recovery
codes. OpenPencil owns workspace and document authorization. For clients that cannot host a browser
redirect, such as the desktop app, the server supports the OAuth device authorization flow and
accepts the resulting bearer token.

Access to a document comes from ownership, workspace membership, a direct grant, or a capability
link, and the strongest source wins. Revoking one source leaves access inherited from another.
Documents granted to someone outside their own workspaces are listed for them separately, so a
client can show what was shared with them.

Workspace administrators invite people by email with a role. Workspace invitations use the same
`/cloud/invitations/:id` link as document invitations: preview and accept look for a workspace
invitation first and fall back to a document one, so email, the desktop handoff, and the editor's
invitation dialog serve both. A workspace with members always keeps an administrator.

Database rows use UUIDs. Capability secrets and invitation tokens are random hex; only their SHA-256
digests are stored, and they travel in URL fragments so they never reach access logs or `Referer`
headers. Invitation continuations through OAuth are single-use compact JWE.

Collaboration tickets are signed, epoch-scoped JWTs naming the principal and permission. Rotating a
capability secret keeps the current epoch; revoking access advances it so old tickets stop working.

## Live collaboration

Collaboration in the editor runs Yjs sync and awareness over a `CollabRoomTransport`. Local
documents use Trystero peer-to-peer; Cloud documents use the Cloud relay, a WebSocket endpoint at
`/api/collaboration/relay` on the API origin. Both carry the same room messages, so the editor has
one sync implementation.

```mermaid
sequenceDiagram
  participant A as Editor
  participant R as Relay (server peer)
  participant B as Viewer
  A->>R: auth (ticket)
  R-->>A: welcome [server]
  R->>A: sync-step1
  A->>R: sync-reply (offline edits)
  B->>R: auth (ticket)
  R-->>B: welcome [server, A]
  B->>R: sync-step1 to server
  R-->>B: sync-reply (room document)
  A->>R: yjs-update
  R-->>B: yjs-update
  B->>R: yjs-update (dropped)
```

The relay joins every room as a peer named `server`. It holds the room's Yjs document, saved in
PostgreSQL by document and collaboration epoch, so a newcomer gets the document even when nobody
else is online. Tickets are short-lived signed JWTs; the client presents a fresh one before the
current one expires, and the relay closes a socket whose ticket lapsed or changed identity.

The relay enforces what the ticket allows: a viewer's document updates and sync replies never leave
it, and presence updates are rewritten so others see the ticket's name and a `cloud` field with the
verified identity and permission. A peer cannot claim presence clients another peer owns. Voice is
not carried over the relay yet; the transport reports no media.

## Enrollment and administration

Enrollment is `open`, `approval`, or `closed`. In approval mode a verified identity creates a
pending request that a deployment administrator approves or rejects; approval can be revoked later.
Deployment administrators are separate from workspace administrators, and startup never grants
either role: the first operator is approved and promoted through the `admin` command.

## Portal

The server shows its own pages on its public address: sign-in and sign-up, email verification,
password reset, two-step sign-in, desktop sign-in approval, account security, and the administration
console. They are a separate Vite entry, `cloud.html`, in the app project, so they reuse the
editor's components and theme without loading the editor; `bun run build:cloud-portal` writes them
to `dist-cloud-portal/`. The editor never embeds these pages; when it needs them, for a social
provider or a second sign-in step, it opens them in a browser and gets the person back through
`/auth/return` or the device code. A verification link started in the editor lands on
`/auth/verified`, which sends the person back to the editor.

`CLOUD_PORTAL_PAGE_ROOTS` in the contract lists the page paths, and every runtime serves
`cloud.html` at and below them with `frame-ancestors 'none'`, so the approval page cannot be
framed. The Node runtime serves the build named by `OPENPENCIL_CLOUD_PORTAL_DIR`, answering portal
pages before the API and portal assets only where the API returns 404. `bun run cloud:dev` keeps a
watched portal build next to the server.

## Editor client

The editor treats each Cloud server as a profile of the `openpencil-cloud` storage provider, with a
workspace as the container, so the sync engine, recent files, and tabs handle Cloud documents the
way they handle a bucket. A server's id is hex from its address, which also names its credentials.
Email and password sign in inside the connect dialog wherever the server accepts the editor's
requests, which is the desktop app and the server's own editor address; the session's bearer token
goes in the credential store. Social providers and accounts with two-step sign-in finish in the
browser: the server's own editor address leaves for its pages and comes back, and the desktop app
approves a device code. Each connection tells a signed-in account from one waiting for approval, one
whose sign-in expired, and one never signed in.

Saves name the revision they were edited from, so a write over someone else's newer revision
becomes a conflict to resolve. Opening a Cloud document also joins its room on the relay. An empty
room takes the first editor's document once the relay has answered; a tab that opened the stored
file takes the room's copy when the room already has one, because each read of a `.fig` gives the
layers new IDs. One signed-in editor, the one with the lowest presence client, saves for the room;
the others drop their queued uploads and count their edits as saved. Guests who open a link join
the room with the link's permission and never save.

## Configuration

Operators author one schema-versioned TOML file. It owns URLs, trusted origins and proxies,
authentication providers, enrollment, object storage, email, worker schedules, retention,
entitlements, and technical limits. Environment variables only supply secrets, through references
such as `{ from_env = "DATABASE_URL" }`, and never override a value the file sets. TOML is parsed
with `smol-toml` and then validated and normalised by Valibot.

Technical limits are safety ceilings, not entitlements: runtime policy can be stricter but never
looser.

## Policy, entitlements, and quotas

OpenFeature answers concrete questions such as whether capability links, anonymous viewing, or
full revision history is kept, and what a numeric limit is. Its provider reads one entitlement
source, chosen by `[entitlements] source`: the static table in the deployment TOML, which applies to
every workspace, or per-workspace rows in the database that the `entitlements` command sets. The two
are alternatives, not layers. Technical limits cap the file size and participant limits the source
reports.

Storage quota uses reservations: the upload locks the workspace's quota row, counts committed usage
plus active reservations, reserves the requested bytes, and commits the verified size when the
upload finishes. Cleanup releases reservations from abandoned uploads.

## Rate limiting

OpenPencil routes use `hono-rate-limiter` with one PostgreSQL store that atomically increments
hashed, namespaced keys, so limits hold across instances. Better Auth keeps its own limiter for
`/api/auth/**`; those routes mount before OpenPencil middleware and are never counted twice.

## Transactional email

Vue Email renders matching HTML and plain-text bodies. Email goes through a PostgreSQL outbox: the
row is written in the same transaction as the change that caused it, payloads are encrypted at rest,
and a worker claims bounded batches with retries. The Node runtime sends through SMTP with
Nodemailer; `email.transport = "none"` disables delivery.

## Tests

| Level       | Location                                                | Needs                   |
| ----------- | ------------------------------------------------------- | ----------------------- |
| Unit        | `packages/cloud/tests/{client,contract,runtime,server}` | nothing                 |
| Integration | `packages/cloud/tests/integration`, mirroring `src`     | PGlite, in process      |
| End-to-end  | `packages/cloud/tests/e2e`                              | Docker Compose services |

`bun run test:cloud` type-checks the package and runs unit and integration tests. The end-to-end
runners start PostgreSQL and SeaweedFS (or Garage) in an isolated Compose project, exercise presigned
and multipart uploads and the full revision flow, and remove the project afterwards.

## Decisions

Choices made while porting Cloud, with what was rejected and why. Add new entries at the end with
their date; revise an entry only by adding one that supersedes it.

**2026-10 · A relay instead of Hocuspocus.** The relay speaks the same room messages as Trystero, so
local and Cloud documents share one sync implementation. A Hocuspocus server would have needed a
second provider in the editor and its own authorization hooks for tickets and viewer filtering.

**2026-10 · The portal is a second Vite entry served only by the server.** Sign-in, approval, and
administration pages reuse the editor's components and theme without shipping in the editor
bundle, and a self-hosted server serves pages that match its own version. Pages inside the editor
would put the approval page under an origin the server does not control; a separate frontend
package would have duplicated the UI kit.

**2026-10 · Rooms are live whenever a Cloud document is open, and one editor saves.** Every open
tab joins the room, and the signed-in editor with the lowest presence client uploads for everyone,
so two people editing together never conflict with each other. Joining only on demand left
concurrent saves to the conflict dialog; building files on the server from the room's Yjs state
needs a headless `.fig` writer on the server, which is a later step.

**2026-10 · A tab takes the room's copy when the room has one.** Reading a `.fig` gives layers new
IDs, so two tabs that read the same file cannot merge their Yjs states. The first editor seeds an
empty room only after the relay answers, and later tabs adopt the room root.

**2026-10 · Redirect sign-in only on the server's own editor address.** There the session cookie is
first-party and the server can send the person back to the same tab. The desktop app and editors on
other origins approve a device code instead of relying on third-party cookies or custom URL
schemes.

**2026-10 · Link secrets stay on the device that created them.** The server stores only digests,
like every capability secret, so a leaked database does not open documents. Other devices offer
**Reset link**, which rotates the secret, instead of a server that can hand the link back.

**2026-10 · Guests never save, and viewers are not locked yet.** A link opens a room with the link's
permission but no account to save under, so a signed-in editor saves for guests. The relay already
drops a viewer's document updates; locking the canvas for viewers needs a read-only mode in Core and
is a follow-up.

**2026-10 · Save to Cloud copies rather than moves.** The local file keeps its last saved contents
and the tab moves to the Cloud document, matching **Save to storage**. Moving would delete a file
the person may still open elsewhere.

**2026-10 · Home is split into places.** Recent files, each server's workspaces, documents shared
with the person, and the storage bucket are separate places in a sidebar, so Cloud does not crowd
the local file list and one server's workspaces show at a time.

**2026-10 · Cloud entry points wait for the official server's listing.** Settings → OpenPencil Cloud
and Save to Cloud stay hidden until `cloud.openpencil.dev` answers discovery with a `listing` whose
minimum editor version this editor meets, a server is already connected on the device, or someone
opened the editor with `?cloud=preview`. Launching, or pulling back, is a change to that server's
config rather than an editor release, and a launch that needs a client change sets the minimum to the
release that has it. A separate flags file or a third-party flag service would be one more thing to
deploy for one switch.

**2026-10 · Email and password sign in inside the editor.** The connect dialog signs in, signs up,
and waits for the verification link itself, and keeps a bearer token, so no cookie has to cross
from the server's address to the editor's; Safari treats sibling `.localhost` hosts as separate
sites and dropped that cookie. Signing in on the server's pages stays for social providers and the
second sign-in step, which need the server's own origin. This supersedes the redirect decision for
email and password.

**2026-10 · Settings → Cloud is always there.** Before the hosted service opens, its card holds the
waitlist, which used to sit under Storage, and a team's own server can be connected at any time.
This supersedes hiding Settings and Save to Cloud until the official server's listing.

**2026-10 · Every account starts with a workspace, and Save to asks only when there is a choice.**
An active account with no workspace gets one of its own when it first asks for its status, under a
slug fixed per person so concurrent requests make one. Save to goes straight to the only workspace
or bucket a document can go to, and New design creates in the place Home shows, so neither asks a
question with one answer. A setup step that makes people name a first workspace would stop them
before they have anything to put in it.

**2026-10 · Workspace invitations share the document invitation link.** Previewing an invitation
says whether it is for a document or a workspace, so one link format, one email path, and one
editor dialog cover both, and the desktop app's link handling needs no new kind. Invitation
continuations through OAuth stay document-only; the editor keeps a pending invitation itself.

**2026-10 · Cloud links hand off to the desktop app through `openpencil://cloud`.** Links stay web
addresses on the server's editor, so they work for anyone; the web editor on a computer offers the
desktop app, which gets the same path, server, and secret as `openpencil://cloud/<kind>/<id>`.
The native side checks the ID, secret, and server before the editor sees a link. The secret is
visible in the launch arguments to other processes on the same computer; pasting links into the
app would avoid that at the cost of a manual step for everyone.

**2026-10 · Cloud's server is Apache-2.0, and the editor builds without it.** The server, relay,
administration, and the pages the server serves are Apache-2.0 for its patent grant; the protocol
in `contract` and `client` stays MIT, so the editor and other clients stay MIT. `REUSE.toml` maps
the paths rather than a separate package, which would have moved the protocol out of
`packages/cloud` for no legal gain. `VITE_OPENPENCIL_CLOUD=off` swaps Cloud's two entry points for
stand-ins, and `check:cloud-off` proves that build bundles none of Cloud.

**2026-10 · History is versions over revisions, compacted on the server.** Every save stays a
revision so saving and conflicts work as before, but the history lists only server-made checkpoints
and named versions, and saves between them are compacted after a day. Checkpoints are made when a
save lands rather than on a timer, so they need no client clock and cover every writer. History stores
`.fig` revisions rather than Yjs snapshots: snapshots would need garbage collection off in every room
and a version would still have to become a file to open, restore, or duplicate.
