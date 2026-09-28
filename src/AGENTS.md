# App

Root Tauri/Vite app. Services and state live under `src/app/**`, views under `src/views/**`, UI under `src/components/**` (UI section below). Use `@/` for cross-directory imports. Detect desktop with `IS_TAURI`.

## Editor session

- `src/app/editor/session/create.ts` wraps Core: it creates reactive state, calls `createEditor()`, and assembles document I/O, autosave, export, vector edit, pen resume, flashes, profiler, and mobile clipboard. Tabs live in `src/app/tabs/`; active editor access in `src/app/editor/active-store/`.
- Use editor actions (`clearSelection()`, `select()`, `setTool()`), never direct state assignments (`packages/core/AGENTS.md`, Editor).
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

## Browser baseline

The supported browser baseline lives in `src/app/shell/support/baseline.ts` and feeds the Vite `build.target`, the startup gate, and the documented system requirements; change all three together, including `desktop/tauri.conf.json` `minimumSystemVersion`. Vite lowers syntax but never polyfills APIs, so two data-driven checks enforce the baseline: the app and browser-shipped packages pin TypeScript `lib` to ES2023 (the last edition those engines implement fully), so newer built-ins fail type-checking, and `compat/compat` (`eslint-plugin-compat` under oxlint, fed the same browsers from `settings.browsers`) rejects Web APIs they lack. Do not raise the lib to `ESNext` in those tsconfigs; use `createDeferred()` from `src/app/runtime/deferred.ts` instead of `Promise.withResolvers()`. Node-only packages (`cli`, `mcp`, `harness`) are exempt from both. `tests/app/shell/support/baseline.test.ts` keeps the tsconfigs and oxlint browsers in step with the baseline. `src/main.ts` must stay a tiny gate that only dynamically imports `src/boot.ts`, so an unsupported engine can still render `src/app/shell/support/` guidance.

## Shell

- Browser and native menus share `src/app/shell/menu/schema.ts`; handle IDs in `use.ts` or editor commands, and regenerate `desktop/generated/menu.json` with `bun run generate:tauri-menu`.
- Motion policy lives in `src/app/shell/motion/`: resolve the persisted System/Off preference and OS reduction once. The root `data-motion` attribute and the Tailwind `motion-safe`/`motion-reduce` variants represent the effective policy, including portalled content. Use the policy-aware Motion adapters rather than repeating preference conditionals in components.
- Keep the app manifest in `vite/pwa.ts`; use `BrandMark` for in-app branding; never symlink web assets to desktop icons (`tools/AGENTS.md`, Brand assets).

## UI

`src/components/ui/**` is generic, store-free design-system code grouped by family: `{button,input,select,toggle,dialog,panel,binding,feedback,overlay,menu,paint}/`. Do not create a folder named after a single component. Feature controls stay in their domain. Theme families mirror these under `src/theme/`; feature themes stay separate. Use explicit imports without old-path forwarding shims.

### Building blocks

- Use Reka UI primitives and typed Tailwind Variants themes under `src/theme/**`; merge per-instance `ui` slot overrides, expose `class` for single-root components, and do not add one-off class props. Use `UI` casing in type names. App wrappers around SDK primitives use shared UI helpers rather than scattered raw classes.
- Tailwind 4 and `tw-animate-css`; no static inline styling or component `<style>` blocks. Dynamic `:style` bindings are allowed for runtime geometry and CSS variables.
- Bind visual state through semantic `data-*` attributes. Steiger rejects template-time `use*UI()`, visual-state utility branches, and raw SVG app icons.
- `Tip`, not native `title`; Lucide/Iconify components, not raw SVG or Unicode icons; `e.code`, not `e.key`, for modified shortcuts.
- App dialogs compose the Reka-backed components under `src/components/ui/dialog/` and the typed theme in `src/theme/dialog.ts`. Do not repeat portal, overlay, content, header, or footer infrastructure in feature dialogs.
- SDK property primitives, binding fields, commands, and i18n: `packages/vue/AGENTS.md`.

### Settings

- Compose Settings sections with `SettingsSection` and its `title`, `description`, `actions`, and default content slots. It owns heading association and internal spacing; `SettingsGroup` owns bordered row grouping. Do not repeat section, header, or spacing markup per feature.
- Settings components own layout, translated copy, confirmation visibility, and emits; small presentation-only computed bindings may stay in components. Workflows, persistence, and credentials: `src/AGENTS.md`.
- `SettingsSaveFeedback` maps domain outcomes (`saved`, `failed`, `partial`) to `AppAlert`. `SettingsLink` owns external-link styling, the icon, and native opening for provider key pages and setup guides; keep arrow glyphs out of translated labels.

### Feedback and forms

- `AppAlert` (`src/components/ui/feedback/AppAlert.vue`, theme `src/theme/feedback/alert.ts`) for persistent contextual errors, warnings, recovery guidance, and informative results, with translated `heading`/`description` and an `actions` slot. Do not hand-roll alert markup or colored error paragraphs. Alerts announce changes without taking keyboard focus.
- The toast service is for transient confirmations such as copying or completing an action after its view closes. Never show a toast and an alert for the same event; partial saves and actionable failures must not disappear in a toast.
- Field validation stays inline in the shared field component with `aria-invalid`, error text before hints, and first-invalid-field focus.
- Ordinary labels such as Running/Stopped remain status text or badges. Destructive confirmation belongs in the shared confirmation dialog.

### Animations

- Tailwind transitions and `tw-animate-css` for simple state changes and enter/exit; the existing `motion-v` dependency for gesture-driven motion, coordinated layout changes, and springs. Do not add another animation library.
- Store-free presets live in `src/theme/motion/` and compose into owning themes; keep what moves, geometry, and feature-specific spring values local. Share repeated duration and easing values. Policy resolution: Shell above.
- Collapsibles use Reka state attributes and measured CSS variables with `animate-collapsible-down` / `animate-collapsible-up`; keep padding and borders inside the animated height wrapper.
- Respect `prefers-reduced-motion` in CSS and Motion; simplify nonessential motion while preserving state changes and feedback. Verify opening, closing, interrupted transitions, reduced motion, and scroll behavior. Expanding historical chat content must not force the transcript to the bottom.

### Storybook

- Colocate `ComponentName.stories.ts` with `ComponentName.vue`; multipart compositions may use a descriptive family name. Preserve explicit titles and exported story names during moves. Default playgrounds stay static; interaction flows get named stories. Prefer inline story fixtures for small app-local states; use colocated `examples/<Variant>.vue` SFCs for substantial templates or fixtures that need SFC template/slot typing, including app-only fixtures (shared SDK examples follow `packages/vue/AGENTS.md`, Documentation). Story templates compile at runtime, so they must be plain JavaScript with no TypeScript syntax, and `icon-lucide-*` tags do not resolve there; import icons from `~icons/...` and register them.
- Isolated visual states of feedback components belong in stories, not Playwright application screenshots. Do not add automated tests or snapshot baselines for CSS-only changes (spacing, sizing, colors, breakpoints); verify those visually. Settings E2E covers integration behavior: feedback appearance, validation and focus, retained drafts, successful retries.
