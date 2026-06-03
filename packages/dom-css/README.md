# @open-pencil/dom-css

DOM and CSS projection utilities for OpenPencil.

This package is the compatibility layer between OpenPencil's scene graph and DOM-shaped design documents. It is intentionally separate from `@open-pencil/core` so browser/CSS parser integrations can evolve without adding DOM dependencies to the renderer and editor core.

## Installation

```sh
bun add @open-pencil/dom-css @open-pencil/core
```

`@open-pencil/core` is a peer dependency because `@open-pencil/dom-css` projects to and from OpenPencil scene graphs. Consumers that only parse/serialize DesignDOM still need the peer installed for the package entrypoint.

## Package-local checks

This package can be validated independently from the app shell:

```sh
cd packages/dom-css
bun run test
bun run typecheck
bun run check
```

Package scripts:

- `bun run test` — package-local Bun tests for runtime, conversion, and Tailwind APIs
- `bun run typecheck` — type-checks `src`, tests, and package scripts
- `bun run build` — builds the distributable `dist` entrypoint
- `bun run smoke:dist` — imports the built `dist` bundle and exercises the public API
- `bun run check` — runs typecheck, tests, build, and dist smoke in sequence

The repository also keeps integration/oracle coverage under `tests/engine/dom-css` and `tests/e2e/dom-css`. The package-local suite focuses on the library's public API, while the repo-level E2E suite verifies browser `getComputedStyle()` parity through Playwright.

## Runtime model

Use the browser runtime as the high-fidelity source of truth whenever a DOM is available. It uses native parsing and `getComputedStyle()` inside an isolated sandbox. Prefer `sandbox: 'iframe'` for production-style conversion because it isolates authored CSS from host-page styles:

```ts
import { createBrowserCSSRuntime } from '@open-pencil/dom-css'

const runtime = createBrowserCSSRuntime({ sandbox: 'iframe' })
const document = runtime.parseHTML('<article class="card">OpenPencil</article>')
const styled = await runtime.computeStyles(document, '.card { width: calc(10rem + 16px); }')
```

The headless runtime is useful for Bun/Node tests, CLI flows, and fast approximate conversion. It supports common selectors, inheritance, shorthands, CSSOM grouping rules, and simple variable/calc values, but it is not a browser replacement. Do not use it as an oracle for browser-only CSS behavior such as layout-dependent computed values, full custom-property fallback behavior, modern color serialization, or UA defaults.

```ts
import { createHeadlessCSSRuntime } from '@open-pencil/dom-css'

const runtime = createHeadlessCSSRuntime()
```

## HTML/CSS to scene graph

The convenience helpers run the full pipeline:

```ts
import { htmlToSceneGraph } from '@open-pencil/dom-css'

const graph = await htmlToSceneGraph(
  '<article class="card"><h1>OpenPencil</h1></article>',
  {
    cssText: '.card { display: flex; gap: 12px; width: 320px; padding: 24px; }'
  }
)
```

For DesignDOM output without creating a scene graph, use `htmlToDesignDocument()`.

## JSX/DOM authoring

Use the package as a JSX import source when you want DOM-shaped authoring that still flows through DesignDOM, CSSOM, and SceneGraph conversion:

```tsx
/** @jsxImportSource @open-pencil/dom-css */
import { createBrowserCSSRuntime, jsxToSceneGraph } from '@open-pencil/dom-css'

const graph = await jsxToSceneGraph(
  <article class="card">
    <h1>OpenPencil</h1>
  </article>,
  {
    cssText: '.card { display: flex; width: 320px; padding: 24px; }',
    runtime: createBrowserCSSRuntime({ sandbox: 'iframe' })
  }
)
```

The JSX runtime preserves `class`, attributes, inline `style`, text, fragments, and simple function components as DesignDOM. Class semantics still come from generated or authored CSS passed to a CSS runtime; the JSX layer does not interpret Tailwind or CSS utility names directly.

When running in a browser, use the browser-first helpers so native `getComputedStyle()` is used automatically:

```tsx
/** @jsxImportSource @open-pencil/dom-css */
import { browserTailwindJSXToSceneGraph } from '@open-pencil/dom-css/browser'

const classes = ['flex', 'flex-col', 'gap-3', 'w-80', 'p-6', 'rounded-xl', 'bg-white']
const graph = await browserTailwindJSXToSceneGraph(
  <article class={classes.join(' ')}>
    <h1>OpenPencil</h1>
  </article>,
  classes,
  { sandbox: 'iframe' }
)
```

Use `browserJSXToDesignDocument()` / `browserJSXToSceneGraph()` for authored CSS, and `browserTailwindJSXToDesignDocument()` / `browserTailwindJSXToSceneGraph()` when Tailwind utilities should flow through Tailwind's compiler first. Import these from `@open-pencil/dom-css/browser` in browser bundles to avoid loading headless-only CSSOM dependencies. Browser Tailwind compilation may need an explicit `css` or `loadStylesheet` option from the host bundler; precompiling with `compileTailwindCSS()` and passing `cssText` to `browserJSXToSceneGraph()` is the most portable browser path.

## Tailwind pipeline

Tailwind classes flow through Tailwind's own compiler, then through the CSS runtime. Prefer the browser runtime when a document is available so custom properties, `calc()`, modern colors, and browser-default behavior come from native `getComputedStyle()`:

```ts
import { createBrowserCSSRuntime, tailwindHTMLToSceneGraph } from '@open-pencil/dom-css'

const classes = ['flex', 'w-80', 'p-6', 'rounded-xl', 'bg-white']
const graph = await tailwindHTMLToSceneGraph(
  `<article class="${classes.join(' ')}">OpenPencil</article>`,
  classes,
  { runtime: createBrowserCSSRuntime({ sandbox: 'iframe' }) }
)
```

`compileTailwindCSS()` remains available when callers want to manage runtime selection themselves.

## Current scope

- DOM-shaped `DesignDocument` / `DesignElement` types
- Browser-backed runtime adapter for native HTML parsing, serialization, and computed-style extraction
- Headless runtime adapter with `parse5` HTML parsing and CSSOM-backed style computation for basic selectors, nested CSSOM rules, cascade order, inheritance, common shorthands, and simple custom-property/calc values
- SceneGraph ⇄ DesignDOM conversion for simple HTML/CSS-shaped layouts, including flex alignment/wrapping, self alignment, absolute positioning basics, logical padding, independent side borders, constraints, clipping, opacity, typography, and shadows
- JSX runtime helpers for DOM-shaped authoring into DesignDOM and SceneGraph
- Tailwind v4 compiler adapter
- Browser oracle fixtures for CSS variables, `calc()`, sandboxed browser-runtime output, modern color output, JSX/Tailwind browser helpers, and Tailwind utility output

## Roadmap

- Expand reusable fixtures: inputs, badges, nav/menu rows, dialog shells, and richer cards
- Map more computed CSS properties to scene graph fields: richer shadows, typography details, position constraints, borders, and grid once OpenPencil's grid support matures
- Improve SceneGraph → CSS export so generated HTML/CSS is useful for JSX, Tailwind, and web export
- Keep `@open-pencil/dom-css` stable before splitting lower-level file-format packages such as future `@open-pencil/kiwi` and `@open-pencil/fig`
