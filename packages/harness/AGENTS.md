# Harness

Optional Node companion for HarnessAgent sessions. Tauri launches the separately installed command; never bundle a JavaScript runtime into Tauri.

- Keep the package backend-neutral.
- Persist only opaque, non-secret resume state. Pi's in-memory `just-bash` cannot recover across process restarts.
- Expose the bounded JSONL host protocol; changes to it must keep the desktop launcher and `desktop/capabilities/**` in sync (`desktop/AGENTS.md`).
- `bun run test:tools` runs this package's tests together with the repo tooling suites.
