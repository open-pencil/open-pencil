# DOM/CSS

DOM, CSS, HTML, JSX, and Tailwind projection between documents and SceneGraph, with browser and headless CSS runtimes. Sources are grouped by direction:

- `src/import/` — HTML, CSS, JSX, and Tailwind to SceneGraph, including the `jsx-runtime` entries and CSS value parsing.
- `src/export/` — SceneGraph to HTML, Tailwind JSX, and Storybook: projection, CSS formatting, the HTML bundle, and printers. `src/export/index.ts` is the `./export` entry.
- `src/runtime/` — browser and headless CSS runtimes.

Rules:

- Depend only on `@open-pencil/scene-graph` and `@open-pencil/codegen`. Engine services such as web-font resolution come in as options; Core registers the HTML and Tailwind JSX formats (`packages/core/AGENTS.md`).
- Keep the `./export` entry browser-safe: load `node:*` modules and the headless CSS object model lazily inside the functions that need them, so the app never bundles them.
- Build generated code as syntax trees with `@open-pencil/codegen` (`es` for TypeScript modules, `jsx` for JSX), not string fragments.
- Imported documents are untrusted: check Base64 with `js-base64`'s `isValid` before decoding.
