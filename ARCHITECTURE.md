# AlphaDesign / OpenPencil — Architecture

This document describes the architecture of **OpenPencil** (repository codename
`AlphaDesign`), with special emphasis on the **frontend** trees (`src/` and
`packages/vue/src/`). It is intended for engineers onboarding to the codebase
and is meant to be navigable: every frontend subdirectory has a directory tree
plus a file-by-file responsibility table derived from reading the actual
imports, exports, and doc comments in each file.

Where this document and `AGENTS.md` disagree, this document reflects the current
source. Notable correction: the `packages/core/src/editor/` directory now
contains **26 modules**, not the 13 listed in the `AGENTS.md` editor table.

---

## 1. Overview

OpenPencil is a Figma-compatible design editor.

- **UI framework:** Vue 3 (`<script setup>`, composition API), Vue Router, reka-ui
  headless components, Tailwind 4, `tailwind-variants` for slot styling,
  unplugin-icons (Iconify/Lucide).
- **Rendering:** the canvas is **CanvasKit (Skia compiled to WASM)** painting to a
  WebGL surface — it is *not* DOM. Rulers, selection handles, marquee, section
  titles, and remote cursors are all painted on the Skia surface.
- **Layout:** **Yoga (WASM)** computes flexbox auto-layout. (CSS Grid is blocked on
  an upstream Yoga limitation.)
- **Packaging:** distributed as a **Tauri v2** desktop app (Rust shell in
  `desktop/`) and *also* runs as a browser PWA. A single `IS_TAURI` constant
  branches runtime behavior; File System Access API is used in-browser with
  Safari `<a download>` fallbacks.
- **Repo:** a **Bun workspace monorepo** (`workspaces: ["packages/*"]`). The root
  package `open-pencil-app` is the Vite/Tauri desktop app living in `src/`.

### How the pieces fit

```text
Desktop / Browser app  (src/, package "open-pencil-app")
        │  imports @open-pencil/vue (public SDK) + @open-pencil/core (subpaths)
        ▼
@open-pencil/vue       (packages/vue/src — headless Vue 3 SDK)
        │  composables + renderless primitives; provides/injects an Editor
        ▼
@open-pencil/core      (packages/core/src — framework-agnostic engine)
        │  scene graph · editor framework · Skia renderer · Yoga layout ·
        │  .fig kiwi codec · vector network · tools/FigmaAPI · color/text
        ▼
CanvasKit (Skia WASM) · Yoga (WASM)
```

The app owns *no* rendering or editing logic of its own. It wires an `Editor`
(from core, wrapped in a reactive Vue store), provides it via the SDK's
`provideEditor()`, and renders UI by composing SDK composables and primitives.
`@open-pencil/cli` and `@open-pencil/mcp` are alternative headless consumers of
the same core engine.

---

## 2. Monorepo layout

| Package | Path | npm name | Purpose |
|---|---|---|---|
| App | `src/` (+ `desktop/`) | `open-pencil-app` (private) | Tauri/Vite desktop + browser editor. THE consumer app. |
| Core | `packages/core/` | `@open-pencil/core` | Framework-agnostic engine: scene graph, editor, Skia renderer, Yoga layout, .fig kiwi codec, vector, tools/FigmaAPI, color, text, lint. Zero DOM deps; runs headless in Bun. |
| Vue SDK | `packages/vue/` | `@open-pencil/vue` | Headless Vue 3 SDK (reka-ui style): composables + renderless primitives for building editor shells. The app is one consumer. |
| CLI | `packages/cli/` | `@open-pencil/cli` | Headless CLI (`citty` + `agentfmt`) for .fig inspection, export, analysis, lint. |
| MCP | `packages/mcp/` | `@open-pencil/mcp` | MCP server (stdio + HTTP/Hono) exposing core tools to AI coding agents. |
| Docs | `packages/docs/` | `@open-pencil/docs` | VitePress documentation site (deployed at openpencil.dev). |

Architecture boundaries between these are enforced by **Steiger**
(`bun run check:arch`): app code must use public package exports; packages must
not import app `src/`; package-local aliases (`#core`, `#vue`, `#cli`, `#mcp`)
are private to their owning package; core stays framework-agnostic.

---

## 3. Frontend deep dive

### 3a. `src/` — the desktop / browser app

The app is structured as **`src/app/*` subsystems** (services, stores, domain
logic — no Vue templates) plus **`src/components/*`** and **`src/views/`** (the UI
layer). Steiger forbids `src/app/**` from importing the component/view layer, and
forbids components from importing views.

#### Top-level entry and configuration

```text
src/
├── main.ts            App bootstrap: preloadFonts(), createApp + router + unhead,
│                      registers PWA service worker when not Tauri.
├── App.vue            Root component: TooltipProvider, provideEditor(store),
│                      useAppTheme(), global error handler, startup update check.
├── router.ts          Routes: "/" and "/demo" (meta.demo) and "/share/:roomId"
│                      → all render EditorView.
├── constants.ts       Re-exports core constants + app constants (collab IDs, ruler
│                      sizes, pen/selection colors, ACP_DESIGN_CONTEXT from .md).
├── app.css            Global Tailwind entry + global CSS (spinner hiding, etc.).
├── env.d.ts           Vite/import.meta env typings.
├── global.d.ts        Window API extensions (showOpenFilePicker, queryLocalFonts).
├── markdown.d.ts      Module typing for `*.md` raw imports.
├── router.d.ts        Route meta typings (e.g. `demo`).
└── app/browser-bridge.ts
                       window.openPencil test/automation hooks: getStore(),
                       setChatTransport(), openFile(); declares Window.openPencil.
```

#### `src/views/`

```text
src/views/
└── EditorView.vue     The single editor screen. Creates/reads the active tab,
                       wires keyboard (useKeyboard), menu (useMenu), collab
                       (useCollab), automation bridge + MCP spawn, splitter layout
                       persistence, demo seeding, and lays out Toolbar / Canvas /
                       Layers / Properties / Collab / Mobile panels.
```

#### `src/app/tauri/`, `src/app/cache/`

```text
src/app/
├── tauri/env.ts       isTauri() runtime check ('__TAURI_INTERNALS__' in window).
└── cache/index.ts     Key/value + bytes/JSON cache abstraction. Tauri uses
                       plugin-fs AppLocalData; browser uses localStorage.
                       read/write/remove Text|Bytes|Json, removeCachePrefix.
```

#### `src/app/editor/` — the editor session and app-specific editor modules

The session wraps core's `createEditor()` in a `shallowReactive` Vue store and
attaches app-only action modules (document I/O, export, vector edit, pen, flash,
profiler, mobile clipboard). The active store is a global proxy.

```text
src/app/editor/
├── session/
│   ├── create.ts        createEditorStore(graph?): builds reactive state,
│   │                    calls core createEditor(), assembles app modules. Exports
│   │                    EditorStore type, re-exports TOOLS/TOOL_SHORTCUTS.
│   ├── modules.ts       defineEditorStoreAccessors (graph/renderer/textEditor
│   │                    getters), createEditorComputedRefs, createEditorStoreModules
│   │                    (wires document IO/export, flash, mobile clipboard, pen,
│   │                    profiler, vector-edit actions onto the store).
│   ├── types.ts         AppEditorState = core EditorState + app UI flags
│   │                    (showUI, showRulers, panelMode, mobileDrawerSnap,
│   │                    nodeEditState, autosaveEnabled, cursor coords, …).
│   └── index.ts         Barrel: createEditorStore, EditorStore, TOOLS.
├── active-store/index.ts  Global active-store registry: setActiveEditorStore,
│                          getActiveEditorStore, useEditorStore() returns a Proxy
│                          forwarding to the active store (so components don't
│                          re-bind on tab switch).
├── canvas/
│   ├── collaboration-awareness.ts  useCanvasCollaborationAwareness: feeds remote
│   │                               cursors/selection into the canvas overlay.
│   ├── context-selection.ts        createCanvasContextSelection: selection helper
│   │                               for canvas context menu.
│   ├── loader-overlay.ts           fadeOutGlobalLoader: hides startup loader.
│   └── menu/
│       ├── actions.ts    createCanvasMenuActions: app-specific canvas menu actions.
│       ├── context.ts    useCanvasContextMenu: assembles the canvas context menu.
│       ├── model.ts      Menu item class/shortcut/component-color helpers.
│       └── registry.ts   Canvas "Copy/Paste as" action ids, labels, test ids.
├── clipboard/paste-to-replace.ts   pasteClipboardToReplace: replace selection
│                                   with clipboard contents.
├── flash/                createFlashActions: transient on-canvas flash highlights.
│   ├── create.ts
│   └── index.ts
├── fonts/
│   ├── cache.ts          Tauri downloaded-font cache (summary/clear/create).
│   └── index.ts          Font loading: preloadFonts, listFamilies/listFonts,
│                         local font access (queryLocalFonts), Google Fonts toggle,
│                         ensureGraphFonts, loadFont (passed into core editor).
├── frame-presets.ts      FRAME_PRESET_CATEGORIES: device/canvas size presets
│                         (typed label keys) for the frame-presets panel.
├── icons.ts              toolIcons, NODE_ICONS, AUTO_LAYOUT_ICONS, COMPONENT_TYPES,
│                         nodeIcon(): maps tools/node types → Lucide components.
├── mobile-clipboard/index.ts  createMobileClipboardActions: in-memory clipboard for
│                              platforms without system clipboard access.
├── pen/
│   ├── create.ts         createPenActions: pen tool state machine bridging.
│   ├── index.ts          Barrel.
│   └── resume.ts         Resume an existing vector path with the pen tool: chain
│                         walking, segment cloning, resumed pen state.
├── profiler/index.ts     createProfilerActions: render profiling toggle bound to
│                         core profiler.
└── vector-edit/          Vector network node-edit mode (live editing of paths).
    ├── create.ts         createVectorEditActions (entry).
    ├── handle-actions.ts createVectorEditHandleActions: bezier handle ops.
    ├── handles.ts        constrainContinuousTangent: handle geometry constraints.
    ├── index.ts          Barrel.
    ├── lifecycle.ts      createVectorEditLifecycle: enter/exit edit mode.
    ├── network.ts        Live VectorNetwork read/write + network actions.
    ├── selection.ts      createVectorEditSelectionActions: vertex/segment selection.
    └── types.ts          NodeEditState, VectorEditState, HandleInfo.
```

#### `src/app/tabs/`

```text
src/app/tabs/index.ts   Multi-document tab store (shallowRef). createTab,
                        switchTab, closeTab, openFileInNewTab (reads .fig via core
                        io, computes layouts), activeTab/allTabs computed,
                        getActiveStore. Switching a tab calls setActiveEditorStore.
```

#### `src/app/document/` — file I/O, autosave, export

```text
src/app/document/
├── io/
│   ├── create.ts          createDocumentIOActions: composes open/reload/save/
│   │                      source/writer/watcher actions into the store.
│   ├── index.ts           Barrel.
│   ├── browser.ts         yieldToUI, createDocumentViewportActions, downloadBlob.
│   ├── read.ts            createOpenActions / createReloadActions (open + reload).
│   ├── save.ts            createSaveActions (save / save-as orchestration).
│   ├── write.ts           createDocumentWriter (encode + persist bytes).
│   ├── source.ts          createDocumentSourceActions (tracks current file source).
│   ├── source-state.ts    createDocumentSourceState (source ref state).
│   ├── save-targets.ts    chooseTauriFigSavePath / chooseBrowserFigSaveHandle.
│   ├── reload-source.ts   readReloadSource (re-read bytes from source).
│   ├── reload-state.ts    capture/restore viewport+selection across reload.
│   ├── imported-document.ts  applyImportedDocument (swap graph after import).
│   ├── names.ts           document/download name derivation from paths.
│   ├── watch.ts           createFileWatcher (external-change watching).
│   ├── watch-targets.ts   watchTauriFile / watchBrowserFile backends.
│   └── types.ts           ViewportSize and related IO types.
├── export/
│   ├── create.ts          createDocumentExportActions + ExportTargetRequest.
│   ├── files.ts           Export bundling: bundleExportFiles (zip), filename/option
│   │                      derivation, Tauri path chooser + writer, saveExportedFile.
│   ├── types.ts           ExportOptions.
│   └── index.ts           Barrel.
└── autosave/
    ├── create.ts          createAutosave: debounced autosave loop bound to state.
    └── index.ts           Barrel.
```

#### `src/app/ai/` — AI chat, ACP agents, tools

```text
src/app/ai/
├── tools/index.ts         createAITools(store): builds FigmaAPI from the store and
│                          calls core toolsToAI(); run-step bookkeeping (MAX_AGENT
│                          _STEPS, StepUsage, tool log entries). Thin wire only.
├── chat/
│   ├── use.ts             useAIChat(): main chat composable (Vercel AI SDK).
│   ├── model.ts           resolveLanguageModelID, createLanguageModel(config).
│   ├── provider-models.ts listProviderModels, OpenRouter model normalization.
│   ├── storage.ts         localStorage-backed provider/key/model/maxTokens/stock-
│   │                      photo-key settings; isConfigured, isACPProvider.
│   ├── transports.ts      createACPTransport, createToolLoopTransport,
│   │                      createChatSessionManager (chat transport assembly).
│   └── system-prompt.md   Chat system prompt (raw markdown import).
├── acp/                   Agent Client Protocol (external coding agents).
│   ├── transport.ts       ACPChatTransport (ChatTransport impl), debug log,
│   │                      connection-error formatting, crash chunk building.
│   ├── map-update.ts      mapUpdate: SessionUpdate → UIMessageChunk; textFromContent.
│   ├── permission.ts      Permission request queue (shallowRef) + respond/reject.
│   ├── process.ts         spawnAcpProcess: spawn agent subprocess (Tauri shell).
│   └── design-context.md  ACP_DESIGN_CONTEXT prompt (raw markdown).
└── debug/index.ts         Token-usage / tool-log / diagnostics formatting and
                           chat-log serialization/copy helpers.
```

#### `src/app/automation/` — local automation bridge + MCP spawn

```text
src/app/automation/
├── bridge/
│   ├── server.ts          connectAutomation: browser-side WebSocket client; runs
│   │                      RPC requests against the live EditorStore, returns results.
│   ├── handlers.ts        createAutomationCommandHandlers (dispatch table).
│   ├── tool-handlers.ts   createAutomationToolHandler (run ToolDefs via FigmaAPI).
│   ├── eval-handler.ts    createAutomationEvalHandler (eval JS with FigmaAPI).
│   ├── export-handlers.ts handleExport / handleExportJsx.
│   ├── file-handlers.ts   handleSaveFile/NewDocument/OpenFile (+ Tauri parent dir).
│   ├── selection-handler.ts  handleSelection.
│   ├── rpc-handler.ts      handleRpcFallback (generic RPC commands).
│   ├── figma-factory.ts    makeFigmaFromStore(store): FigmaAPI from a store.
│   └── vite-plugin.ts      automationPlugin: dev-server bridge endpoint.
└── mcp/spawn.ts           spawnMCPIfNeeded, getAutomationAuthToken,
                           AutomationServerHandle (Tauri-side MCP server lifecycle).
```

#### `src/app/collab/` — real-time collaboration (Yjs + Trystero/WebRTC)

```text
src/app/collab/
├── use.ts             useCollab(storeOrGetter): main composable — connect/disconnect,
│                      cursor/selection broadcast, follow mode. Provided via COLLAB_KEY.
├── context.ts         COLLAB_KEY injection key, useCollabInjected().
├── session.ts         CollabRuntime, connection actions, connectCollabSession,
│                      awareness-zoom watcher, teardown/reset helpers.
├── room.ts            connectCollabRoom: Trystero room (WebRTC over MQTT signaling).
├── awareness.ts       buildRemotePeers, remotePeersToCursors, follow actions,
│                      generateRoomId (crypto.getRandomValues).
├── local-awareness.ts createLocalAwarenessActions: publish local cursor/selection.
├── yjs-sync.ts        Yjs ↔ SceneGraph bridge: prop sync both directions, graph-event
│                      binding, Yjs observers, createYjsGraphSync.
└── types.ts           RemotePeer, CollabState, DEFAULT_COLLAB_STATE.
```

#### `src/app/shell/` — keyboard, menus, theme, toasts, updater

```text
src/app/shell/
├── keyboard/
│   ├── use.ts           useKeyboard(): installs global shortcut handling.
│   ├── registry.ts      registerKeyboardShortcuts (tinykeys binding from registry).
│   ├── actions.ts       createKeyboardActions (shortcut → editor command).
│   ├── clipboard.ts     bindEditorClipboard (system copy/cut/paste events).
│   ├── nudging.ts       bindNudgeKeys (arrow-key nudge).
│   ├── space-tool.ts    bindSpaceHandTool (hold space = pan).
│   ├── focus.ts         isEditing / isInputElement guards.
│   ├── reserved.ts      isReservedModShortcut, preventReservedKeyboardDefaults.
│   └── types.ts         Keyboard shortcut action/option types.
├── menu/
│   ├── schema.ts        APP_MENU_SCHEMA: canonical menu model (all/browser/native).
│   │                    Shared by browser Menubar AND the native Tauri menu builder.
│   ├── use.ts           useMenu(): handles menu item activation; openFileFromPath.
│   ├── app-menu.ts      useAppMenu(): builds AppMenuGroup[] for the browser menu bar.
│   ├── editor-actions.ts align/text-format helpers + createSharedEditorMenuActions.
│   ├── files.ts         File open/import dialogs (Tauri + browser FS Access).
│   ├── document-name.ts useDocumentNameRename.
│   ├── entry.ts         Menu-entry type guards/accessors (separator/action/checkbox).
│   └── shortcut.ts      appMenuShortcut → tinykeys / Tauri accelerator conversions.
├── toast/action.ts      useActionToast (transient action toast).
├── ui.ts                toast object (push/error handler), openExternalLink,
│                        initials(), decodeTauriStderr.
├── theme.ts             AppTheme ('dark'|'light'|'auto'), useAppTheme().
├── updater.ts           checkForAppUpdate, scheduleStartupUpdateCheck (Tauri updater).
├── layout-storage.ts    load/saveEditorLayout (splitter sizes persistence).
└── markdown/index.ts    Markdown rendering helper stub.
```

#### `src/app/demo/` — the demo document generator

```text
src/app/demo/
├── document.ts        createDemoShapes(store): builds the full demo scene.
├── colors.ts          DEMO_COLORS, solid()/gradient()/thinStroke() fill helpers.
├── effects.ts         dropShadow/innerShadow/blurEffect builders.
├── helpers.ts         makeComponent(store, ids).
└── sections/
    ├── app-preview.ts   createAppPreviewSection.
    ├── components.ts     createComponentsSection.
    ├── effects.ts        createEffectsSection.
    ├── standalone.ts     createStandaloneShapes.
    └── variables.ts      createDemoVariables.
```

#### `src/components/` — the UI layer

The app's components are thin wrappers around `@open-pencil/vue` renderless
primitives and composables; styling is applied with `tailwind-variants` slot
objects through the `src/components/ui/*` `use*UI()` helpers. App components never
use `<style>` blocks (Steiger-enforced) and never assign `editor.state.*`
directly.

**Top-level components and panels**

```text
src/components/
├── EditorCanvas.vue       The Skia canvas host. Uses SDK useCanvas/useCanvasInput/
│                          useTextEdit + core constants; renders rulers/overlays.
├── Toolbar/               Toolbar (desktop + mobile) built on SDK ToolbarRoot/Item.
│   ├── Toolbar.vue          Responsive switch (Desktop/Mobile).
│   ├── DesktopToolbar.vue / MobileToolbar.vue
│   ├── ToolbarActionGroup.vue / ToolButton.vue / ToolFlyout.vue
│   ├── actions.ts           useToolbarActions (tool list + handlers).
│   └── types.ts             ToolbarActionItem, ToolbarUi, ToolLabels, ToolIconMap.
├── LayersPanel.vue        Layers panel shell (uses useI18n).
├── LayerTree.vue          Wraps SDK LayerTreeRoot/Item + useInlineRename.
├── PagesPanel.vue         Wraps SDK PageListRoot + useInlineRename.
├── PropertiesPanel.vue    Right-hand properties panel shell.
├── DesignPanel.vue        Design tab content (useSelectionState/useEditorCommands).
├── CodePanel.vue          Selection → JSX (core design-jsx selectionToJSX).
├── ChatPanel.vue          AI chat panel.
├── AssetsPanel.vue        Components/assets browser.
├── CanvasMenu.vue         Canvas context menu (renders SDK menu-model entries).
├── AppMenu.vue            Browser-only menu bar (reka-ui Menubar); hidden in Tauri.
├── AppToast.vue           Global toast renderer.
├── TabBar.vue             Document tab strip.
├── ZoomDropdown.vue       Zoom control (useEditorCommands).
├── MobileDrawer.vue       Mobile bottom-sheet panel host.
├── SafariBanner.vue       Safari File-System-Access limitation banner.
├── VariablesDialog.vue    Design-variables dialog (useVariablesEditor).
├── ScrubInput.vue         Drag-to-change number input (SDK ScrubInput primitive).
├── FillPicker.vue         Fill editor (SDK FillPickerRoot).
├── GradientEditor.vue     Gradient stops editor (SDK GradientEditor primitives).
├── ImageFillPicker.vue    Image fill editor.
├── FontPicker.vue         Font family picker (SDK FontPickerRoot).
└── PickerSlider.vue       Generic labeled slider (SDK inputNumberValue/vTestId).
```

**Component namespace folders** (PascalCase, with a local `context.ts` where the
folder needs a provide/inject context):

```text
src/components/
├── ColorPicker/           App color-picker wrappers over SDK ColorPicker primitive.
│   ├── ColorPicker.vue      props color/okhcl, emits update.
│   └── ColorInput.vue       Hex/format text entry.
├── ColorPickerPanel/       Full color-picker popover panel (provides context.ts).
│   ├── ColorPickerPanel.vue, ColorAreaControl.vue, HueAlphaSliders.vue,
│   ├── FormatControls.vue, RgbFields.vue, HsbFields.vue, HslFields.vue,
│   ├── OkhclFields.vue       Channel field groups.
│   └── context.ts            provide/useColorPickerPanel.
├── FontSettings/
│   ├── FontSettingsPopover.vue
│   └── use.ts                useFontSettings (local font access / download / clear).
├── CollabPanel/            Collaboration share/join UI (provides context.ts).
│   ├── CollabPanel.vue, ConnectedRoom.vue, ShareOrJoinRoom.vue,
│   ├── JoinRoomPrompt.vue, CollabSharePopover.vue, CollabAvatarStack.vue
│   └── context.ts            provide/useCollabPanel.
├── MobileHud/              Mobile heads-up display (provides context.ts).
│   ├── MobileHud.vue, MobileActiveToolBadge.vue, MobileActionToast.vue,
│   ├── MobileUndoRedo.vue, MobileFileMenu.vue, MobileShareButton.vue,
│   ├── MobilePresencePopover.vue
│   └── context.ts            provide/useMobileHud.
└── chat/                   AI chat sub-components.
    ├── ChatInput.vue, ChatMessage.vue
    ├── AcpPermissionDialog.vue      ACP permission approve/reject dialog.
    ├── ProviderModelSelect.vue, ProviderSetup.vue
    ├── ProviderSelect/              ProviderSelect.vue, ProviderSelectField.vue
    └── ProviderSettings/            Provider config form (provides context.ts):
        ├── ProviderSettings.vue, ProviderSettingsField/Input/KeyField/Link.vue,
        ├── ApiKeySection.vue, ApiTypeSection.vue, CustomEndpointSection.vue,
        ├── MaxTokensSection.vue, StockPhotoKeysSection.vue
        └── context.ts                provide/useProviderSettings.
```

**Properties panel** (`src/components/properties/`) — the right-panel section
components; internals are Steiger-quarantined to this folder.

```text
src/components/properties/
├── PositionSection.vue          X/Y/W/H/rotation (usePosition).
├── LayoutSection/               Auto-layout / flex / grid controls.
│   ├── LayoutSection.vue, AutoLayoutControls.vue, FlexControls.vue,
│   ├── GridControls.vue, PaddingControls.vue, SizeControls.vue,
│   ├── ClipContentControl.vue
│   └── types.ts                 GridTrackProp, PaddingProp.
├── AppearanceSection.vue        Opacity/blend/corner radius (useAppearance).
├── FillSection.vue              Fills list (useFillControls) + ColorStyleRow.
├── StrokeSection.vue            Strokes (useStrokeControls).
├── EffectsSection.vue           Shadows/blur (useEffectsControls).
├── TypographySection.vue        Text properties (useTypography).
├── ExportSection.vue            Export settings list (useExport) + ExportScaleInput.
├── ExportScaleInput.vue         Per-target scale entry.
├── PageSection.vue              Page-level properties.
├── VariablesSection.vue         Bound variables overview.
├── VariablePickerPopover.vue    Pick a variable to bind.
├── VariableScrubInput.vue       Number input bindable to a variable.
├── BoundVariableButton.vue      Toggle/show a variable binding.
├── VariantSection.vue           Component-set variant properties.
├── BooleanOperationsControl.vue Union/subtract/intersect/exclude.
├── ColorStyleRow.vue            A single fill/stroke color row.
├── color-style-row.ts           Opacity %, bound-variable swatch helpers.
├── fill-label.ts                fillLabel(fill, boundVariable).
└── fill-okhcl.ts                createFillOkhclAdapter (OkHCL adapter for a fill).
```

**Shared UI primitives** (`src/components/ui/`) — the app design system. Each
`*.ts` defines a `tailwind-variants` (`tv`) slot config and a `use*UI()` helper
that components merge through; the few `.vue` files are reusable widgets.

```text
src/components/ui/
├── button.ts / icon-button.ts / input.ts / select.ts / menu.ts / popover.ts /
│   dialog.ts / section.ts / surface.ts / picker-slider.ts / toast.ts / tooltip.ts
│        → tv() slot definitions + use*UI() helpers (the canonical :ui pattern).
├── AppInput.vue / AppSelect.vue / AppGroupedSelect.vue / AppComboboxInput.vue
├── AppBadge.vue / AppTextButton.vue / AppShortcutText.vue / Tip.vue
└── (consumed everywhere; Steiger forbids ui/** from importing app services/stores)
```

### 3b. `packages/vue/src/` — the `@open-pencil/vue` headless SDK

The SDK is **reka-ui–style**: composables (`useX`) carry logic and state; renderless
**`*Root.vue` / `*Item.vue` primitives** expose state through slots (no styling).
A consumer calls `provideEditor(editor)` once, then every composable/primitive
reads the editor back through injection (`useEditor()` / `EDITOR_KEY`).

The single public entry is `packages/vue/src/index.ts`, which re-exports
`createEditor`/`provideEditor`/`useEditor`, all `useX` composables, and all
primitives. Internally the package uses the `#vue/*` path alias.

#### Editor context, commands, menus, selection

```text
packages/vue/src/editor/
├── context/index.ts          EDITOR_KEY, provideEditor(editor), useEditor().
├── events/use.ts             useEditorEvent(event, handler): auto-disposing
│                             subscription to the core editor event bus.
├── commands/
│   ├── use.ts                useEditorCommands(): EditorCommand map (run + enabled).
│   ├── registry.ts           EDITOR_COMMAND_METADATA: canonical shortcut tokens,
│   │                         keybindings, context-menu test ids (single source).
│   ├── definitions.ts        createEditorCommandMap: command implementations.
│   ├── edit.ts / selection.ts / view.ts  Command groups (edit / selection / view).
│   ├── actions.ts            Shared command action helpers.
│   ├── context.ts            Command execution context.
│   ├── shortcut.ts           shortcutPlatform(), formatShortcut() (⌘/⌥ vs Ctrl/Alt).
│   └── types.ts              Command types.
├── menu-model/
│   ├── use.ts                useMenuModel(): MenuEntry/MenuActionNode model.
│   ├── canvas.ts             buildCanvasContextMenu (canonical canvas menu layout).
│   ├── command-groups.ts     Grouping of commands into menu sections.
│   ├── builders.ts           Menu-entry builder helpers.
│   └── types.ts              Menu model types.
├── selection-state/use.ts        useSelectionState(): reactive selection summary.
├── selection-capabilities/use.ts useSelectionCapabilities(): what ops the current
│                                 selection allows (group, boolean ops, etc.).
├── inline-rename/use.ts          useInlineRename<T>(): generic rename-edit state.
├── viewport-kind/use.ts          useViewportKind(): isMobile/desktop breakpoints.
└── tool-cursor/index.ts          toolCursor(tool, override): CSS cursor per tool.
```

#### Canvas integration (Skia surface + all pointer/keyboard input)

This is the largest SDK area: it owns the CanvasKit surface lifecycle, the render
loop, and every canvas input mode (tools, transform, pen, node-edit, text-edit).

```text
packages/vue/src/canvas/
├── index.ts                  Barrel: CanvasRoot, CanvasSurface, useCanvasContext.
├── CanvasRoot.vue            Renderless root that provides the canvas context.
├── CanvasSurface.vue         The <canvas> element host.
├── context/index.ts          CANVAS_KEY, provideCanvas, useCanvasContext.
├── useCanvasInput.ts         useCanvasInput(): top-level input orchestrator
│                             (delegates to tool/transform/pen/node/text inputs).
├── surface/                  CanvasKit/WebGL surface management.
│   ├── use.ts                useCanvas(opts): the main surface composable.
│   ├── types.ts              UseCanvasOptions, CanvasRenderLayer.
│   ├── kit-loader.ts         useCanvasKitLoader: load CanvasKit WASM.
│   ├── gl-surface.ts         makeGLSurface, sizeCanvas (WebGL surface creation).
│   ├── lifecycle.ts          createCanvasSurfaceManager / useCanvasSurfaceLifecycle.
│   ├── render-loop.ts        createCanvasRenderLoop (renderVersion/sceneVersion).
│   ├── resize-observer.ts    useCanvasResizeObserver (rAF-throttled resize).
│   └── overlays.ts           Ruler visibility + canvas hit-test setup.
├── pointer/use.ts            createCanvasPointer: low-level pointer normalization.
├── tool-input/use.ts         handleToolMouseDown + tool-input dispatch.
├── transform-input/          Select / move / resize / rotate / marquee / pan.
│   ├── use.ts, actions.ts     createTransformInputActions.
│   ├── marquee.ts, pan.ts, rotation.ts, text-selection.ts
├── pen-input/                Pen tool input.
│   ├── use.ts (startPenInput, updatePenHover), drag.ts (createPenDrag/move).
├── node-edit-input/          Vector node-edit input.
│   ├── use.ts (hover/mouseup), bend.ts (bezier bend handle math).
├── text-edit/                On-canvas text editing (hidden textarea bridge).
│   ├── use.ts                useTextEdit(canvasRef, editor).
│   ├── textarea.ts           Hidden textarea + focus management.
│   ├── editing.ts            Caret blink, IME composition, edit actions.
│   ├── input.ts / keyboard.ts / navigation.ts  Keyboard + caret navigation.
│   ├── formatting.ts         Bold/italic/underline etc. while editing.
│   └── clipboard.ts          Text copy/cut/paste during editing.
├── drop/use.ts               useCanvasDrop: drag-drop images; clipboard image extract.
└── overlays/useCanvasVirtualReference.ts  Virtual reference rect for floating popovers.
```

#### Property/control composables (`controls/`)

These are the data layer behind the property panel; each returns reactive values
and setters reading/writing the injected editor (with undo batching via
`undo-batch`). Most consist of a `use.ts` (the composable) and a `helpers.ts`.

```text
packages/vue/src/controls/
├── node-props/use.ts            useNodeProps(): reactive node properties, MIXED
│                                sentinel + MixedValue across multi-selection.
├── position/use.ts              usePosition(): X/Y/W/H/rotation.
├── layout/use.ts                useLayout(): auto-layout / flex / grid / size limits.
├── appearance/use.ts            useAppearance(): opacity, blend, corner radius.
├── fill/use.ts                  useFillControls(): fills list ops.
├── stroke/use.ts                useStrokeControls(): strokes.
├── effects/use.ts               useEffectsControls(): shadows/blur.
├── typography/use.ts            useTypography(opts): text props (+ actions.ts).
├── okhcl/use.ts                 useOkHCL(): OkHCL color controls.
├── color-variable-binding/use.ts   useColorVariableBinding(kind).
├── number-variable-binding/use.ts  useNumberVariableBinding(path).
├── variable-binding/use.ts      useVariableBinding(opts): generic bind state.
├── prop-scrub/use.ts            usePropScrub(editor): scrub-drag → prop change.
└── undo-batch/use.ts            useUndoBatch(undo): batches edits into one undo step.
```

#### Document export, variables, i18n, internal, testing, primitives

```text
packages/vue/src/document/export/
├── use.ts                useExport(): export settings + run.
└── helpers.ts            EXPORT_SCALES, EXPORT_FORMATS, default export settings.

packages/vue/src/variables/
├── use.ts                useVariables(): variables overview.
├── helpers.ts            collection + value action factories.
├── dialog/use.ts         useVariablesDialogState().
├── editor/use.ts         useVariablesEditor(): full variable CRUD editor state.
└── table/                useVariablesTable + column defs (@tanstack table).

packages/vue/src/i18n/
├── index.ts              Re-exports; menu/command/tool/panel/page/dialog messages.
├── locale.ts             AVAILABLE_LOCALES (en/de/es/fr/it/pl/ru/zh-CN), setLocale,
│                         nanostores `locale` atom + browser detection.
├── useI18n.ts            useI18n(): reactive translated message bundles.
├── messages.ts           Base (English) message catalog (Steiger-checked: no
│                         shortcut text in labels).
└── (locales/*.json)      Translations: de, es, fr, it, pl, ru, zh-CN.

packages/vue/src/internal/
├── create-context.ts     createContext<T>(name): provide/inject factory.
└── scene-computed/use.ts useSceneComputed(fn): computed that tracks sceneVersion.

packages/vue/src/testing/
├── test-id.ts            TestId types + test-id builders (toolbar, acp, variables…).
└── v-test-id.ts          vTestId directive (data-testid binding).

packages/vue/src/global.d.ts   SDK ambient types (window/font APIs).
```

**Renderless primitives** (`primitives/`) — each folder has a `*Root.vue`
(provides a context via a local `context.ts`), optional sub-items, an
`index.ts` barrel, and often a `useX.ts` composable:

```text
packages/vue/src/primitives/
├── ColorPicker/        ColorPickerRoot.vue, ColorInputRoot.vue + model.ts
│                       (createColorPickerModel, slider gradient/preview models,
│                        RGB/HSB/HSL/OkHCL channel updaters, applySolidFill/Stroke).
├── FillPicker/         FillPickerRoot.vue + useFillPicker(fill, onUpdate).
├── GradientEditor/     GradientEditorRoot/Bar/Stop.vue + useGradientStops.
├── FontPicker/         FontPickerRoot.vue + useFontPicker (font access controller).
├── LayerTree/          LayerTreeRoot/Item.vue, context.ts (LayerNode tree),
│                       useLayerDrag (drag-reorder/reparent instructions).
├── PageList/           PageListRoot.vue + usePageList.
├── Toolbar/            ToolbarRoot/Item.vue, context.ts, useToolbarState.
├── ScrubInput/         ScrubInputRoot/Field/Display.vue, context.ts.
├── PropertyList/       PropertyListRoot/Item.vue, context.ts (generic prop list).
├── LayoutControls/     LayoutControlsRoot.vue, context.ts.
├── PositionControls/   PositionControlsRoot.vue.
├── AppearanceControls/ AppearanceControlsRoot.vue.
└── TypographyControls/ TypographyControlsRoot.vue.
```

**Shared input + DOM helpers** (`shared/`) — pure, editor-driven geometry/gesture
helpers used by the canvas input modes (not Vue-specific beyond a few composables).

```text
packages/vue/src/shared/
├── dom-events.ts          inputValue/inputNumberValue/blurTarget/selectTarget.
├── font-status/use.ts     useNodeFontStatus(node): font-loaded state for a node.
├── assets/                resize-cursor.svg, rotate-cursor.svg (canvas cursors).
└── input/                 The drag/gesture engine shared by canvas input:
    ├── types.ts             DragDraw/DragMove/DragPan, HandlePosition, etc.
    ├── geometry.ts          pointer↔canvas coords, hit tests, screen rects, handles.
    ├── select.ts + select/  Selection down/hit/hover/move.
    ├── move.ts, move-snap.ts, drag-original.ts, duplicate-drag.ts  Move + snap + dup.
    ├── resize.ts + resize/   Resize (rect aspect constraints, start, vector scaling).
    ├── draw.ts              Shape/text draw (down/move/up).
    ├── pan.ts, pan-zoom.ts, wheel.ts, gesture.ts, space-key.ts  Pan/zoom/gestures.
    ├── auto-layout.ts, auto-layout-hover.ts  Auto-layout drop indicators.
    ├── drop-target.ts       findMoveDropTarget, reparentOutsideNodes.
    ├── node-edit/           hit-test.ts (vertex/handle hit), index.ts (down/move).
    ├── click-count.ts       Multi-click counter (single/double/triple).
    └── raf-scheduler.ts     createRafScheduler (batched flush per frame).
```

### 3c. How `src/` and `packages/vue` relate to `packages/core`

Verified against actual imports:

- The app imports `@open-pencil/core` through **targeted subpath exports**:
  `src/app/editor/session/create.ts` imports from `@open-pencil/core/editor`,
  `@open-pencil/core/io`, `@open-pencil/core/scene-graph`;
  `src/app/tabs/index.ts` imports `@open-pencil/core/io/formats/fig` and
  `@open-pencil/core/layout`; components import `@open-pencil/core/color`,
  `@open-pencil/core/design-jsx`, `@open-pencil/core/constants`, etc.
- The app imports the SDK through the **single public entry** `@open-pencil/vue`
  (e.g. `App.vue` → `provideEditor, useI18n`; `EditorView.vue` →
  `useViewportKind, formatShortcut`; pickers → `FillPickerRoot`, `ColorPickerRoot`).
- The SDK itself re-exports core's editor types/`createEditor` from
  `@open-pencil/core/editor` and consumes core throughout via `import type` plus a
  small number of runtime imports; CanvasKit is loaded only in the canvas surface
  loader and passed as a parameter.

The data flow at runtime: the app builds an `Editor` (`createEditor`) inside a
reactive store, `provideEditor(store)` makes it injectable, and SDK
composables/primitives mutate the scene graph through the editor's action methods
(never assigning `state.selectedIds`/`state.activeTool` directly — both the app
and SDK go through `editor.select()` / `editor.setTool()` so the core event bus
fires).

---

## 4. Core engine summary (`packages/core/src/`)

Framework-agnostic, zero DOM dependencies, runs headless in Bun. The package
exposes domain-scoped subpath exports; the `"."` barrel re-exports everything.

| Subdir | Subpath export | Responsibility |
|---|---|---|
| `scene-graph/` | `/scene-graph` | `SceneGraph` (flat `Map` + `parentIndex`), node types, hit-test, copy, snap, undo, variables, instances, vector-network, previews. Domain types (`SceneNode`, `Fill`, `Stroke`, `Effect`, …) live here. |
| `editor/` | `/editor` | Framework-agnostic editor framework (see table below). |
| `canvas/` | `/canvas` | `SkiaRenderer` — the Skia/CanvasKit painting engine. |
| `canvaskit` (file) | `/canvaskit` | `getCanvasKit()` WASM loader (the only runtime `canvaskit-wasm` import). |
| `layout/` | `/layout` | `computeLayout`/`computeAllLayouts` via Yoga WASM. |
| `color/` | `/color` | parseColor, colorToHex/CSS, color management, OkHCL (culori). |
| `text/` | `/text` | Fonts, text editor, style runs, direction. |
| `vector/` | `/vector` | Vector network blob encode/decode + bezier math. |
| `figma-api/` | `/figma-api` | `FigmaAPI`, `FigmaNodeProxy` — Figma Plugin API-compatible execution target for all tools. |
| `tools/` | `/tools` | `ToolDef`/`defineTool`, `ALL_TOOLS` registry, AI adapter (`toolsToAI`), prompts. Split by domain (read/create/modify/structure/variables/vector/analyze). |
| `io/` | `/io`, `/io/formats/{fig,pen,jsx,raster,svg}` | `IORegistry` + format codecs (read/write). `.fig` lives under `io/formats/fig`. |
| `kiwi/` | `/kiwi` | Kiwi binary `.fig` codec/protocol (fflate, fzstd); vendored runtime in `kiwi/schema-runtime`. |
| `clipboard/` | `/clipboard` | Figma/OpenPencil clipboard parsing + import. |
| `design-jsx/` | `/design-jsx` | JSX↔design renderer (`selectionToJSX`, `JSX_REFERENCE`; sucrase). |
| `icons/` | `/icons` | Iconify API client + icon rendering. |
| `lint/` | `/lint` | Design linter rules + presets. |
| `profiler/` | `/profiler` | Render profiling. |
| `rpc/` | `/rpc` | RPC commands (used by CLI). |
| `geometry/`, `bytes/` | `/geometry`, (`/random`, `/xpath`, `/types`, `/constants`) | Shared geometry, byte, GUID/Color/Vector/Matrix/Rect types, constants (incl. `IS_TAURI`). |

### Editor modules (`packages/core/src/editor/`)

`create.ts` assembles an `EditorContext`, wires the nanoevents event bus, and
spreads per-domain action factories (`createXxxActions(ctx) => {…}`) into a flat
`Editor` object (`Editor = ReturnType<typeof createEditor>`). The **26** modules:

```text
create.ts          types.ts          state.ts           index.ts
viewport.ts        page-viewports.ts  selection.ts       pages.ts
shapes.ts          structure.ts       nodes.ts           components.ts
component-sync.ts  clipboard.ts       undo.ts            text.ts
alignment.ts       nudge.ts           layout-mode.ts     layout-runner.ts
graph-events.ts    graph-reads.ts     tool-registry.ts   color-space.ts
variables.ts       variable-bindings.ts
```

Notable: `graph-events.ts` bridges `SceneGraph` emitter events to the editor
event bus; `component-sync.ts` propagates component edits to instances;
`layout-runner.ts`/`layout-mode.ts` drive Yoga; `variables.ts` /
`variable-bindings.ts` handle design variables. (This corrects the `AGENTS.md`
"13 modules" table.) The editor event bus contract — `render:requested`,
`node:*`, `selection:changed`, `tool:changed`, `page:changed`, `viewport:changed`
— is consumed from the Vue side via `useEditorEvent()`.

---

## 5. Other packages

### `packages/cli/` — `@open-pencil/cli`

Headless CLI (`bun open-pencil …`). `index.ts` (citty) wires commands under
`commands/`: `info`, `tree`, `find`, `query`, `node`, `pages`, `variables`,
`selection`, `formats`, `convert`, `export`, `lint`, `eval`, and `analyze/`
(colors/typography/spacing/clusters). `format.ts` re-exports `agentfmt`
formatters with project adapters (`nodeToData`, `nodeToTreeNode`, …);
`headless.ts`/`app-client.ts`/`rpc-data.ts` provide the headless runtime. CLI
commands are hand-written (not generated from ToolDefs); `eval` is the CLI's
gateway to all ToolDef operations via `FigmaAPI`.

### `packages/mcp/` — `@open-pencil/mcp`

MCP server for AI coding tools. `index.ts` (Hono + Streamable HTTP with sessions)
plus `stdio.ts`/`stdio-bridge.ts` for stdio transport. `server.ts` registers all
core `ToolDef`s as MCP tools (zod schemas) plus MCP-only tools (`open_file`,
`new_document`, `save_file`, `get_codegen_prompt`) that need fs access. The
browser connects via WebSocket (`browser-rpc.ts`); `auth.ts`, `mcp-sessions.ts`,
`http-options.ts`, `result.ts`, `json.ts`, `jsx-preprocess.ts` round it out.

### `packages/docs/` — `@open-pencil/docs`

VitePress documentation site deployed at openpencil.dev (guide, SDK, automation,
reference, development/roadmap; localized into de/es/fr/it/pl). No code detail
needed here — it is the user/contributor documentation surface.

---

## 6. Build & tooling notes

| Path | Role |
|---|---|
| `desktop/` | Tauri v2 Rust shell. `tauri.conf.json` (windows, permissions, updater pubkey), `Cargo.toml`, `src/` (Rust: native menu builder consuming `generated/menu.json`), `capabilities/` (scoped shell/fs permissions), `icons/`, `Info.plist`, `build.rs`, `updater.key.pub`. The native menu is generated from the shared `src/app/shell/menu/schema.ts` via `bun run generate:tauri-menu`. |
| `vite/` | Vite plugins: `aliases.ts` (`@/`, `#vue`, `#core`…), `automation.ts` (automation bridge), `canvaskit-assets.ts` (serve CanvasKit WASM), `raw-markdown.ts` (`*.md` raw import for prompts), `pwa.ts` (PWA/service worker), `server.ts`, `empty-node-module.ts`. |
| `tools/` | Private repo tooling, each `tools/<domain>/src/*` with tests: `architecture` (Steiger rules), `i18n`, `package-quality`, `release-packages`, `tauri-menu` (menu generator), `type-shapes`, `visual-oracles`, `pr-review-guidance`. Layout enforced by Steiger; covered by `bun run test:tools`. |
| `scripts/` | Thin compatibility shims importing `tools/*`: `generate-tauri-menu.ts`, `visual-bisect.ts`, `visual-compare.ts`, `export-fixture-visuals.ts`. No logic lives here. |
| `lint/` | `plugin.js` — custom lint plugin. |
| `vite.config.ts` | App Vite config (composes the `vite/` plugins). |
| `tsconfig.json`, `tsconfig.node.json` | TypeScript project config + path aliases. |
| `steiger.config.ts` | Steiger architecture-boundary rules (`bun run check:arch`). |
| `oxlint.json` | oxlint rules. |
| `playwright.config.ts` | Playwright visual-regression / E2E (`tests/e2e/**`). |
| `components.d.ts` | Auto-generated unplugin-vue-components / unplugin-icons typings. |

### Quality gates

`bun run check` (oxlint + tsgo type-aware lint/typecheck + architecture checks),
`bun run check:vue` (vue-tsc), `bun run format` (oxfmt), `bun run test:dupes`
(jscpd), `bun run test:tools`, `bun test ./tests/engine` (unit), `bun run test`
(Playwright). Tests are placement-strict (Steiger): E2E under `tests/e2e/**`
(`*.spec.ts`), Figma automation under `tests/figma/**`, engine/unit under
`tests/engine/**` (`*.test.ts`).
