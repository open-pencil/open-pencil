# @open-pencil/harness

Optional Node companion runtime for coding-agent harness sessions. It owns the backend-neutral session lifecycle, opaque resume-state persistence, and the JSONL sidecar protocol used by host applications.

The first backend uses AI SDK `HarnessAgent`, Pi, and local `just-bash`. Pi runs in the Node host process; `just-bash` provides an isolated in-memory workspace and shell without requiring cloud infrastructure.

## Current scope

- Backend-neutral, streaming session service.
- Atomic, bounded persistence of opaque harness resume state.
- JSONL stdio sidecar transport.
- Pi + `just-bash` backend.

The package is installed as an optional companion CLI for the desktop application. It is not bundled into every Tauri build; install `@open-pencil/harness` globally to make the `openpencil-harness` command available. It runs on Node 22.15 or later, or Bun: Pi's MCP adapter publishes TypeScript sources, which the companion strips through Node's module hooks. Credentials are supplied to the companion process at runtime and are never written to resume-state storage.

## Local sandbox limitation

`just-bash` is process-local and in-memory. Multi-turn sessions work while the sidecar remains alive, but its sandbox cannot be reattached after a process restart. A backend that reports `sessionResume: 'live-process'`, as Pi does, therefore starts a stopped session fresh and drops its saved state. Durable restart recovery requires a persistent sandbox provider in a later integration.
