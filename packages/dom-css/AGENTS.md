# DOM/CSS

DOM, CSS, HTML, JSX, and Tailwind projection between documents and SceneGraph, with browser and headless CSS runtimes. Sources are grouped by direction:

- `src/import/` — HTML, CSS, JSX, and Tailwind to SceneGraph, including the `jsx-runtime` entries and CSS value parsing.
- `src/export/` — SceneGraph to HTML, Tailwind JSX, and Storybook: projection, CSS formatting, the HTML bundle, and printers. `src/export/index.ts` is the `./export` entry.
- `src/export/storybook/mapping/` — the shared versioned component mapping schema, saved-identity resolution, and reference-module emission; filesystem ownership belongs to the CLI and navigation to the app.
- `src/behaviours/` — what a behaviour means in the DOM, shared by preview and export: controls and layer roles, story props, and state styles compiled from variants. Exported from `./export`.
- `src/runtime/` — browser and headless CSS runtimes.
- `src/tokens/` — variables as design tokens: CSS custom property names, Tailwind namespaces from `twirlwind`, and units. Shared by both directions and exported from `./export`.

Rules:

- Depend only on `@open-pencil/scene-graph` and `@open-pencil/emit`. Engine services such as web-font resolution come in as options; Core registers the HTML and Tailwind JSX formats (`packages/core/AGENTS.md`).
- Keep the `./export` entry browser-safe: load `node:*` modules and the headless CSS object model lazily inside the functions that need them, so the app never bundles them.
- Build generated code as syntax trees with `@open-pencil/emit` (`es` for TypeScript modules, `jsx` for JSX, `vue` for single-file components), not string fragments.
- Imported documents are untrusted: check Base64 with `js-base64`'s `isValid` before decoding.
- Import maps CSS flow onto the auto layout semantics in `@open-pencil/scene-graph` from `src/import/flow.ts`: an element's display comes from CSS or its tag's default, block flow stacks and stretches block-level children, flex items stretch across by default, and padding and borders sit outside an explicit size unless `box-sizing: border-box`. It records fill and hug and never sizes text; Core measures and lays out what it builds (`packages/dom-css/tests/import/flow.test.ts`).
- `./scene-graph` is the browser-safe entry for building layers from a styled DOM. The main entry carries the headless CSS runtime, whose CSSOM dependency has no browser build with the exports it uses, so browser bundles must not import it.
- Rich text maps one way in both directions: style runs are spans that set only what differs from the text, linked runs are `<a href>` in the text's own look, text with lists, paragraph spacing, or a first-line indent is blocks of `<p>`, `<ul>`, and `<ol>` with Figma's markers and the space after each paragraph as a margin, and on import inline content or box-less text blocks in normal flow join into one text layer while a flex box's children stay apart (`src/export/text.ts`, `src/import/text.ts`, `packages/dom-css/tests/import/text.test.ts`).
