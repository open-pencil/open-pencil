# Desktop (Tauri v2)

Check `desktop/Cargo.toml`, `desktop/capabilities/**`, and `desktop/tauri.conf.json` before adding desktop capabilities. Release versions are also set in `desktop/tauri.conf.json` and `desktop/Cargo.toml` (`tools/AGENTS.md`, Releases).

- File system and shell permissions must be configured explicitly; a vague "Internal error" save failure usually means a missing permission.
- Dev tools: add or use a menu item to toggle them; do not rely on keyboard shortcuts.
- `desktop/src/credentials.rs` stores secrets in the native system credential store; failures must surface, never fall back to browser or plaintext storage (`src/AGENTS.md`, Settings).
- ACP and harness process changes require checking `desktop/capabilities/**`.
- The fs scope allows documents anywhere but denies, in the global `fs:scope`, every place where a written file would run, and `requireLiteralLeadingDot` keeps hidden files out of `**` on every platform; a new write path must not reopen either (`tests/e2e/native/fs-scope.spec.ts`).
- A `shell:allow-spawn` entry pins the whole command line: no `"args": true`, and a Windows `.cmd` shim runs through its own `cmd-<name>` entry with fixed `/c <name> …` arguments, which `resolvePlatformCommand` selects (`tests/engine/tauri/command.test.ts`).
- The Software Update window is a second webview labelled `updater` that loads `updater.html` (`src/updater.ts`), never the editor's `index.html`; its own capability, `desktop/capabilities/updater.json`, grants only checking, installing, restarting, closing, and opening links. It owns no documents, so before a restart or a Windows install it asks the editor window over `updater:restart-request` to run the Quit approval (`src/app/shell/updater/approvals.ts`, `tests/app/shell/updater/session.test.ts`).
- Never click Install in a `tauri dev` build: the updater unpacks the release next to the running binary, which there is `desktop/target/debug`.
- `desktop/generated/menu.json` is produced by `bun run generate:tauri-menu` from `src/app/shell/menu/schema.ts`; do not edit or import it directly.
- Run `bun run generate:icons --target desktop` before direct Cargo checks; native icons are generated, not committed.
- `build_fig_file` performs `.fig` export on desktop; the browser path uses fflate (`packages/fig/AGENTS.md`).
- The embedded WebDriver plugin compiles only with the `native-test` Cargo feature and must never be enabled in development or production binaries. Native tests use `bun run test:native` (`tests/AGENTS.md`).
- `openpencil://` links are parsed in `desktop/src/deep_link.rs`: `open` queues files through `take_pending_open`, `join` queues validated room IDs through `take_pending_rooms`; second launches forward their link arguments through the single-instance handler (`deep_link` unit tests).
