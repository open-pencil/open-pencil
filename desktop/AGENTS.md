# Desktop (`desktop/`)

Tauri v2 desktop shell.

- Check `desktop/Cargo.toml`, `desktop/capabilities/**`, and `desktop/tauri.conf.json` before adding desktop capabilities.
- File system and shell permissions must be configured explicitly; vague "Internal error" save failures often mean missing permissions.
- Dev tools: add or use a menu item to toggle, don't rely on keyboard shortcuts.
- Secrets are stored in the native system credential store through `desktop/src/credentials.rs`; see `src/AGENTS.md` for the credential manager contract.
- Native menus are generated from the shared schema `src/app/shell/menu/schema.ts` via `bun run generate:tauri-menu`; `desktop/generated/menu.json` is consumed by the Tauri menu builder. Do not add menu items directly in `desktop/src/menu.rs`.
- ACP transport uses Tauri shell permissions, so check `desktop/capabilities/**` when changing agent launch behavior.
