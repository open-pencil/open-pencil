# Vue SDK

Headless Vue 3 primitives and composables; the root app is one consumer. Primitives are controlled and editor-agnostic. Stories follow `src/AGENTS.md` (Storybook).

## Property primitives

- Fields compose variable/token binding through `BindingProvider` (`packages/vue/src/controls/binding-provider/`) and `BindableValue` (`packages/vue/src/primitives/BindableValue/`). Keep numeric interaction in `NumberField`; providers own binding lookup, mutation, and undo batching.
- `PropertySection`, `SegmentedControl`, and `PropertyList` under `packages/vue/src/primitives/` are controlled and editor-agnostic. Connect PropertyList events to selection and undo through `useEditorPropertyList()` or an app adapter; never call `useEditor()` from a primitive.
- Compose property rows from `PanelGrid`, `PanelFieldGroup`, `PanelItemRow`, and `PropertyItemRow`; use `BindableValue`, `FillRoot`, and `FillSwatch` rather than rebuilding binding or picker infrastructure.
- Binding-aware fields detach or mutate only on the first value change; opening and focusing are non-destructive.
- Prefer models, events, and props over imperative slot actions except for explicitly renderless action primitives. Use VueUse for DOM refs and focus.
- Preserve interaction gotchas when refactoring: splitter handles, NumberField pointer ownership, section dragging, panel containment, and number-spinner styling.

## Retained panels

The app's `DesignPanel` retains at most one selection-property subtree through `RetainedPanel`. The app installs `createRetainedScopePlugin()`; opted-in descendants receive `provideRetainedActivity()`. Vue component scopes are detached, so pausing only a parent or bare `KeepAlive` does not suspend descendant work. Cancel drafts synchronously before DOM detachment can fire blur, close transient state and gate portals with `useRetainedPopup()`, and invalidate pending async results on deactivation or disposal. The plugin lets cleanup flush before pausing each component scope and resumes it on activation; it requires Vue's Options API. Unmounting the owning editor releases the retained subtree.

## Preview islands

- Preview runs controls as real components, never as canvas simulations: `packages/vue/src/canvas/islands/` renders each top-level layer that holds an instance with a behaviour as DOM in a shadow root over the canvas, projected through `@open-pencil/dom-css`, and mounts each behaviour's Reka UI primitives on its layers. Typing, focus, and keyboard handling belong to the browser and Reka.
- Islands only map layers to Reka components. Which layer is a control, part, item, trigger, panel, or input comes from `behaviourControls` and `controlRoles` in `@open-pencil/dom-css`, which code export shares; never derive roles in Vue (`packages/dom-css/tests/behaviours/controls.test.ts`).
- The concept, the pipeline from state to DOM, and how to add a kind are in `packages/docs/development/behaviours-and-preview.md`.
- Variants draw control states: Core's `resolvePlayState` shows instances in a state on a private graph, and controls are keyed by layer path so a variant switch keeps their DOM, including a focused input. The document is never changed (`packages/core/tests/editor/play/states.test.ts`, `tests/e2e/components/behaviours.spec.ts`).

## Commands, menus, i18n

- Commands use `packages/vue/src/editor/commands/registry.ts` for shortcuts, bindings, and menu IDs. Store portable tokens (`MOD+D`) and format them at render time; labels and translations never contain shortcuts.
- Canvas menu structure lives in `packages/vue/src/editor/menu-model/canvas.ts`; the app's `CanvasMenu.vue` renders it.
- `useEditorEvent(event, handler)` in `packages/vue/src/editor/events/use.ts` wraps the editor event bus.
- i18n uses narrow product-domain catalogs under `packages/vue/src/i18n/messages/` with matching locale files. Inspect existing domains instead of adding generic UI/component namespaces; prefer narrow `use*Messages()` composables over aggregate `useI18n()`. `bun run check:i18n` enforces structure, placeholder parity, and reviewed translation baselines; remove stale baseline identities when fixing existing debt.

## Documentation

VitePress is the canonical public SDK documentation; Storybook is the internal state workshop. API tables are extracted from source and JSDoc with `vue-component-meta`, so keep descriptions next to public props, events, and slots, and keep examples valid against public exports (`packages/docs/AGENTS.md`). An example shared by Storybook and a docs page lives in `packages/vue/src/primitives/<Primitive>/examples/<Variant>.vue` (PascalCase variant, e.g. `States.vue`); the story renders it and the docs page imports it with `#vue/primitives/...`. Do not render Storybook stories inside VitePress pages: `@storybook/vue3` assigns `window.STORYBOOK_ENV` on import so it cannot be server-rendered, the docs bundle ships runtime-only Vue so runtime templates silently fail, and a client-only embed drops examples from the prerendered HTML while adding the Storybook preview runtime and `storybook/test` to the published docs.
