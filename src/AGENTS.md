# App (`src/`)

The root app is the Tauri/Vite desktop editor. App-specific editor, document, AI, collaboration, shell, tabs, demo, and automation code lives under `src/app/*`.

## Editor session

The app editor session (`src/app/editor/session/create.ts`) is a Vue wrapper around core: it creates reactive state, calls `createEditor()`, and assembles app-specific document I/O, autosave, export, vector edit, pen resume, flashes, profiler, and mobile clipboard. Tabs live in `src/app/tabs/`; active editor access lives in `src/app/editor/active-store/`.

App-layer code should use editor actions such as `clearSelection()`, `select()`, or `setTool()` — never direct `state.selectedIds =` or `state.activeTool =` assignments (see the event-bus invariant in `packages/core/AGENTS.md`).

## Settings and credentials

Credential persistence lives under `src/app/settings/credentials/`. Settings components receive `CredentialManager` and may inspect status, replace, or clear credentials; runtime adapters receive `CredentialResolver`. Components must not read saved secrets or keep them in long-lived reactive refs. Non-secret provider preferences remain in normal settings storage.

Tauri stores secrets in the native system credential store through `desktop/src/credentials.rs`; browsers default to WebCrypto-encrypted IndexedDB storage and may explicitly opt out to session-only memory. Native failures must never silently fall back to browser or plaintext storage. New integration credentials use stable `CredentialRef` values and join the unified Settings surface rather than adding feature-local key forms.

Storage-provider schemas and runtime adapters live under `src/app/integrations/storage/`; non-secret preferences and credential references stay separate, and adapters resolve secrets at operation time. Local-first document caching and outbox synchronization live under `src/app/storage/`. A remote storage binding augments document source state and must not replace local file identity.

Every storage read must bypass the browser HTTP cache (`cache: 'no-store'` at the fetch seam — a cached response is the wrong content, not an old copy; this is what resurrected trashed documents on 2026-08-03). `read-freshness.test.ts` asserts the seam, and `putDocument` never carries metadata — the engine writes the sidecar at upload completion, never from a dispatch-time snapshot. Onboarding a new provider requires a browser-side probe (overwrite an object, GET it plainly and with `no-store`, diff the bodies — curl proves nothing, it has no cache) plus recording response-side behavior (`Cache-Control`, ETag presence, `Last-Modified` granularity, CORS-exposed headers) and same-key ordering guarantees in the capability matrix at `packages/docs/user-guide/cloud-storage.md`.

Bitmap-to-vector conversion lives in `packages/core/src/vector/vectorize/`; app provider clients, preferences, and lazy credential resolution live under `src/app/editor/vectorize/`. Keep provider credentials in the centralized credential manager, bound request and response sizes, and validate provider-owned download URLs before importing returned SVG.

App dialogs compose the Reka-backed components under `src/components/ui/dialog/` and the typed theme in `src/theme/dialog.ts`. Do not repeat portal, overlay, content, header, or footer infrastructure in feature dialogs.

## ACP and collaboration

Keep this section light; implementation details move often.

- ACP UI/transport lives under `src/app/ai/acp/**`; provider definitions live in `packages/core/src/constants.ts`; app prompts live under `src/app/ai/**`. Direct model configuration lives under `src/app/ai/models/**`: reusable profiles reference provider connections, roles resolve to profiles, and runtime creation resolves credentials lazily. Keep model profiles, provider connections, and role assignments separate rather than returning to singleton provider/model settings. Public docs: `packages/docs/programmable/ai-chat.md` and `packages/docs/programmable/mcp-server.md`.
- ACP transport uses Tauri shell permissions, so check `desktop/capabilities/**` when changing agent launch behavior.
- Collaboration lives under `src/app/collab/**` and is documented in `packages/docs/programmable/collaboration.md`. It uses Trystero + Yjs + awareness; preserve crypto-safe room IDs and peer cleanup semantics when changing it.
- App chat/ACP prompts live under `src/app/ai/**` markdown files; core codegen prompts live in `packages/core/src/tools/prompts/`.
- `src/app/ai/tools/index.ts` is a thin app wire that creates `FigmaAPI` from the active editor for the core tool registry.

## UI

### Component structure

- `src/components/ui/**` is the app design-system layer: reusable visual primitives, wrappers around Reka UI primitives, low-level styled controls, and UI class helpers. These files must not import app services/stores or feature panels.
- `src/components/Shell/**` is for app shell chrome and global app services rendered as components (menu bar, toast viewport, update/status chrome). Shell components may use app shell/editor stores.
- `src/components/properties/**`, `src/components/chat/**`, `src/components/LayerTree/**`, `src/components/Toolbar/**`, and similar folders are feature/domain component namespaces. Keep feature-specific controls there unless they are genuinely reusable UI primitives.
- Treat existing root-level picker/input/control components as migration candidates when touched; do not expand that pattern.
- Property-panel composition uses `PanelGrid`, `PanelFieldGroup`, `PanelItemRow`, and `PropertyItemRow`; do not reintroduce generic row wrappers such as the removed `PanelRow`. Variable-capable fields compose `BindableValue` providers, and fill UIs compose `FillRoot` / `FillSwatch` with a consumer-owned popover rather than rebuilding a combined picker wrapper.
- Test locators follow Playwright's user-facing priority: role/name, label, and text first. Multi-part components expose scoped `data-slot` anatomy; app concepts use semantic attributes such as `data-property`, `data-command`, and `data-node-id` when accessible identity is insufficient. Reserve `data-test-id` for rare integration boundaries such as the canvas/editor host, never add `testId`/`testHook` props, and do not manufacture globally unique compound IDs inside shared components.

### Styling and composition

- Use reka-ui for UI components (Splitter, ContextMenu, DropdownMenu, etc.)
- Vue UI styling APIs follow the Nuxt UI architecture: static Tailwind Variants themes live under `src/theme/**` with `slots`, `variants`, `compoundVariants`, and `defaultVariants`; components resolve the theme with `tv()` and merge per-instance `ui` overrides at each rendered slot. Single-root components expose `class` rather than a one-slot `ui` object. Do not add one-off `fooClass`, `barClass`, `emptyActionClass`, etc. props. Use `UI` casing in type names (`SelectUI`, not `SelectUi`).
- Steiger parses Vue templates and rejects visual-state Tailwind utility branches, template-time `use*UI()` calls, and raw SVG app icons. Bind semantic state through `data-*` attributes and resolve typed theme variants in script instead of bypassing the rule.
- App wrappers around SDK primitives should compose a single `ui` object from shared UI helpers (`useSelectUI`, `usePopoverUI`, etc.) rather than bypassing the design system with raw Tailwind strings spread across multiple props.
- Tailwind 4 for styling — no inline CSS, no component-level `<style>` blocks
- Prefer `tw-animate-css` for animations — don't hand-write `<style>` transition keyframes
- Use `Tip` / tooltip components for hover help; do not add native `title` attributes in Vue UI.
- Icons: use unplugin-icons with Iconify/Lucide (`<icon-lucide-*>`) — don't use raw SVG or Unicode symbols
- Mac keyboards: use `e.code` not `e.key` for shortcuts with modifiers (Option transforms characters)
- Binding-aware fields must not mutate or detach on focus. Start detach/edit-variable transactions only on the first actual value mutation; opening the variable picker is also non-destructive.
- Preserve established UI gotchas in nearby components before refactoring: splitter handle sizing, NumberField pointer ownership, section drag targets, side-panel containment, and global number-spinner styling.

### Menus

- Browser and Tauri menus share `src/app/shell/menu/schema.ts` as the canonical menu model. Do not add menu items directly in `src/components/Shell/AppMenu.vue` or `desktop/src/menu.rs`.
- Regenerate the native menu with `bun run generate:tauri-menu` after editing the shared menu schema; `desktop/generated/menu.json` is consumed by the Tauri menu builder. Tauri also runs this generator from `desktop/tauri.conf.json` via `beforeDevCommand` and `beforeBuildCommand`.
- Every shared menu item with an `id` must be handled by `src/app/shell/menu/use.ts`, an editor command, or explicitly marked browser/native-only in the schema.
- App menu (`src/components/Shell/AppMenu.vue`) — browser-only menu bar using reka-ui Menubar components; Tauri uses native menus, so menu is hidden when `IS_TAURI` is true.
- Canvas context-menu structure lives in `packages/vue/src/editor/menu-model/canvas.ts`. Do not hand-build command grouping in `src/components/canvas/CanvasMenu.vue`; the component should render menu entries and provide app-specific actions only when unavoidable.

## App conventions

- `@/` import alias for app cross-directory imports; app feature code lives under `src/app/*`
- Window API extensions (showOpenFilePicker, queryLocalFonts) live in `src/global.d.ts` and `packages/core/src/global.d.ts`
- Use `@vueuse/core` hooks — prefer higher-level composables (`useBreakpoints`, `useEventListener`, `onClickOutside`, etc.) over raw APIs (`useMediaQuery`, manual `addEventListener`)
- Prefer VueUse utilities for simple browser/timer state: `refAutoReset` for temporary copied/saved flags, `promiseTimeout` for async sleeps/retry backoff, `useClipboard`/`useFileDialog`/`useLocalStorage` where they fit the local state model. Don't force VueUse when direct APIs are clearer: one-shot `requestAnimationFrame` focus/defer calls, explicit service-owned reconnect/permission timers, or nanostores-backed state can stay hand-rolled.
- No module-level mutable state in components — use the editor store
- Name repeated or cross-feature constants; use `src/constants.ts` for app-wide constants rather than feature-local values.

## File handling in the app

- `showOpenFilePicker` / `showSaveFilePicker` are File System Access API (Chrome/Edge), not Tauri-only; code must keep browser fallbacks.
- Safari save: no File System Access API → use an `<a>` download fallback with deferred `revokeObjectURL`. SafariBanner warns users about limitations.
- Tauri detection: use `IS_TAURI` from `@open-pencil/core/constants` / `src/constants.ts`; don't inline `__TAURI_INTERNALS__` checks.
