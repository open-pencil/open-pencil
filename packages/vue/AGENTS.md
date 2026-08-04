# Vue SDK (`packages/vue`)

Headless Vue 3 SDK (Reka UI-style) for building custom OpenPencil-powered editor shells and embedded editing surfaces. Renderless components and composables. The app is one consumer of the SDK.

## Primitives and binding

- Headless SDK fields compose variable/token binding through `BindingProvider` and the `BindableValue` primitives in `packages/vue/src/controls/binding-provider/` and `packages/vue/src/primitives/BindableValue/`. Keep numeric interaction in `NumberField`; providers own binding lookup, mutation, and undo batching.
- Property-panel anatomy in `packages/vue/src/primitives/PropertySection/`, `SegmentedControl/`, and `PropertyList/` is controlled and editor-agnostic. Connect PropertyList events to OpenPencil selection and undo through `useEditorPropertyList()` or an app adapter; never call `useEditor()` from these primitives.
- Do not pass imperative setters/actions through slots as `:set-*`, `:update-*`, `:request-*`, `:toggle-*`, etc. unless the component is explicitly a renderless primitive whose whole contract is slot actions. Prefer `v-model`, emitted events, normal component props, or owned default UI. For DOM refs/focus, use VueUse (`templateRef`, `unrefElement`, `useFocus`, etc.) instead of ref callback plumbing through slots.

## Commands, i18n, menus

- Editor commands share `packages/vue/src/editor/commands/registry.ts` as the canonical source for shortcut display tokens, keyboard bindings, and context-menu test IDs. Store portable shortcuts such as `MOD+D`, `MOD+SHIFT+H`, and `MOD+ALT+K`; format them with `formatShortcut()` at render time so macOS shows `⌘`/`⌥` and Windows/Linux show `Ctrl`/`Alt`.
- Labels and translations must not contain shortcut text. Keep labels semantic (`Add auto layout`, `Show/Hide`) and render shortcuts from command metadata. Steiger enforces this for `packages/vue/src/i18n/messages.ts` and locale JSON files.
- Canvas context-menu structure lives in `packages/vue/src/editor/menu-model/canvas.ts`. App components render menu entries and provide app-specific actions only when unavoidable.
- Subscribe to editor events in Vue with `useEditorEvent(event, handler)` from `packages/vue/src/editor/events/use.ts`.

## Stories and docs

- Storybook is the internal component-state workshop (`bun run storybook`, `bun run build-storybook`), while VitePress is the canonical public SDK documentation. Colocate `*.stories.ts` with app UI components and use toolbar themes for light/dark states instead of adding test-only routes or showcase pages to the app.
- Reuse colocated Vue demo components between Storybook and VitePress rather than maintaining separate examples. Style shared demos with Tailwind; the docs theme scans Vue SDK primitive demos through its dedicated Tailwind source.
- Public component API tables are generated from Vue source and JSDoc with `vue-component-meta`; do not manually duplicate props, events, slots, or exposed APIs in Markdown. SDK examples are processed by VitePress Twoslash and must resolve against the public `@open-pencil/vue` API.
