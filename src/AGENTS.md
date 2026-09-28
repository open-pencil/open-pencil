# App

Root Tauri/Vite app. Services and state live under `src/app/**`, views under `src/views/**`, UI under `src/components/**` (`src/components/AGENTS.md`). Use `@/` for cross-directory imports. Detect desktop with `IS_TAURI`.

## Editor session

- `src/app/editor/session/create.ts` wraps Core: it creates reactive state, calls `createEditor()`, and assembles document I/O, autosave, export, vector edit, pen resume, flashes, profiler, and mobile clipboard. Tabs live in `src/app/tabs/`; active editor access in `src/app/editor/active-store/`.
- Use editor actions (`clearSelection()`, `select()`, `setTool()`), never direct state assignments (`packages/core/src/editor/AGENTS.md`).
- File System Access APIs are browser APIs, not Tauri-only. Keep the Safari download fallback and defer `revokeObjectURL`.
- Vectorize provider clients, preferences, and lazy credential resolution live under `src/app/editor/vectorize/`; conversion itself is in Core.

## Settings, credentials, storage

- Reactive settings workflows live under the owning domain's `settings/` folder (for example `src/app/ai/models/settings/profile-editor/{use,selection,connection}.ts`), not a global composables bucket. `use.ts` orchestrates; focused siblings hold substantial sub-workflows. Persistence and external operations stay in domain services; pure option projections are ordinary functions. Return operation outcomes rather than importing dialogs, routers, or toasts into workflows. Guard async results against changed targets.
- Persistence outcomes (`saved`, `failed`, `partial`) stay in the domain: preferences and a native credential store cannot transact together. Preserve retryable drafts, reuse already-persisted identities on retries, and surface the partial-save warning. Never render raw credential backend errors or secrets.
- New explicit settings forms use headless VeeValidate v5 with native Valibot schemas and existing controlled UI components; form state lives in the owning settings domain. VeeValidate owns validation and submission state; domain workflows keep their own pending/lifecycle guards. Saved secrets and replacement-secret drafts stay outside form snapshots and devtools. A credential-store failure does not make the entered key invalid.
- Credential persistence lives under `src/app/settings/credentials/`. Settings components receive `CredentialManager` and may inspect status, replace, or clear; runtime adapters receive `CredentialResolver` and resolve secrets at operation time. Components must not read saved secrets or keep them in long-lived reactive refs; keep newly entered secrets short-lived. Non-secret provider preferences stay in normal settings storage.
- Tauri stores secrets in the system credential store through `desktop/src/credentials.rs`; browsers default to WebCrypto-encrypted IndexedDB and may explicitly opt out to session-only memory. Native failures must never silently fall back to browser or plaintext storage. New integration credentials use stable `CredentialRef` values and join the unified Settings surface rather than feature-local key forms.
- Storage-provider schemas and runtime adapters live under `src/app/integrations/storage/`; non-secret preferences and credential references stay separate. Local-first document caching and outbox synchronization live under `src/app/storage/`. A remote storage binding augments document source state and must not replace local file identity.

## AI, ACP, automation, collaboration

- `src/app/ai/tools/index.ts` binds Core ToolDefs to the active editor's `FigmaAPI`. The chat and ACP prompt compose the Core authoring reference rather than copying it (`packages/core/AGENTS.md`, Tools).
- ACP transport lives under `src/app/ai/acp/**`; provider definitions in `packages/core/src/constants.ts`; profiles in `src/app/ai/models/**`. Keep provider connections, reusable profiles, and role assignments separate, and resolve credentials lazily. ACP process changes require checking `desktop/capabilities/**`.
- Browser-native WebMCP registration lives under `src/app/automation/webmcp/`, consumes per-tool exposure metadata, and is feature-detected through `document.modelContext`. App completion under `src/app/automation/execution/` loads fonts after commit.
- Collaboration lives under `src/app/collab/**` on Trystero, Yjs, and awareness; preserve crypto-safe room IDs and peer cleanup.

## Shell

- Browser and native menus share `src/app/shell/menu/schema.ts`; handle IDs in `use.ts` or editor commands, and regenerate `desktop/generated/menu.json` with `bun run generate:tauri-menu`.
- Motion policy lives in `src/app/shell/motion/`: resolve the persisted System/Off preference and OS reduction once. The root `data-motion` attribute and the Tailwind `motion-safe`/`motion-reduce` variants represent the effective policy, including portalled content. Use the policy-aware Motion adapters rather than repeating preference conditionals in components.
- Keep the app manifest in `vite/pwa.ts`; use `BrandMark` for in-app branding; never symlink web assets to desktop icons (`tools/AGENTS.md`, Brand assets).
