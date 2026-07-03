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

The headless runtime is useful for Bun/Node tests, CLI flows, and fast approximate conversion. It supports common selectors, inheritance, shorthands, CSSOM grouping rules, and simple variable/calc values, but it is not a browser replacement. Do not use it as an oracle for browser-only CSS behavior such as layout-dependent computed values, full custom-property fallback behavior, modern color serialization, or UA defaults. Do not expand headless CSS parsing with ad hoc regex/string parsers; add a maintained parser/runtime dependency or use the browser runtime instead.

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

When running in a browser, use the browser-first helpers so native `getComputedStyle()` is used automatically. Import them from `@open-pencil/dom-css/browser` so browser bundles do not load headless-only CSSOM dependencies:

```tsx
/** @jsxImportSource @open-pencil/dom-css */
import { browserJSXToSceneGraph } from '@open-pencil/dom-css/browser'

const graph = await browserJSXToSceneGraph(
  <article class="card">
    <h1>OpenPencil</h1>
  </article>,
  {
    cssText: '.card { display: flex; width: 320px; padding: 24px; }',
    sandbox: 'iframe'
  }
)
```

Use `browserJSXToDesignDocument()` / `browserJSXToSceneGraph()` for authored CSS. Use `browserTailwindJSXToDesignDocument()` / `browserTailwindJSXToSceneGraph()` only when Tailwind utilities should be compiled at runtime by the host app. Browser Tailwind compilation needs the host bundler to provide Tailwind source CSS or stylesheet loading; see the Tailwind recipes below.

## Tailwind pipeline

Tailwind classes flow through Tailwind's own compiler, then through the CSS runtime. Prefer the browser helpers when a document is available so custom properties, `calc()`, modern colors, and browser-default behavior come from native `getComputedStyle()`.

### Browser recipe: precompiled Tailwind CSS

The most portable browser path is to compile Tailwind CSS in the host app, then pass the resulting CSS as normal `cssText`:

```ts
import { browserHTMLToSceneGraph } from '@open-pencil/dom-css/browser'

import tailwindCSS from './generated-tailwind.css?raw'

const graph = await browserHTMLToSceneGraph(
  '<article class="flex w-80 rounded-xl bg-white p-6">OpenPencil</article>',
  {
    cssText: tailwindCSS,
    sandbox: 'iframe'
  }
)
```

This also works with JSX:

```tsx
/** @jsxImportSource @open-pencil/dom-css */
import { browserJSXToSceneGraph } from '@open-pencil/dom-css/browser'

import tailwindCSS from './generated-tailwind.css?raw'

const graph = await browserJSXToSceneGraph(
  <article class="flex w-80 rounded-xl bg-white p-6">OpenPencil</article>,
  {
    cssText: tailwindCSS,
    sandbox: 'iframe'
  }
)
```

### Browser recipe: runtime Tailwind compilation with supplied CSS

If the app wants to compile utility candidates at runtime, provide Tailwind source CSS yourself. Do not rely on the default Node-oriented stylesheet loader in browser bundles:

```ts
import { browserTailwindHTMLToSceneGraph } from '@open-pencil/dom-css/browser'

const classes = ['flex', 'w-80', 'rounded-xl', 'bg-white', 'p-6']
const graph = await browserTailwindHTMLToSceneGraph(
  `<article class="${classes.join(' ')}">OpenPencil</article>`,
  classes,
  {
    css: await fetch('/tailwind-source.css').then((response) => response.text()),
    sandbox: 'iframe'
  }
)
```

Use `loadStylesheet` when the supplied Tailwind CSS contains imports and the host app owns import resolution:

```ts
import { browserTailwindHTMLToSceneGraph } from '@open-pencil/dom-css/browser'

const classes = ['flex', 'w-80', 'rounded-xl', 'bg-white', 'p-6']
const graph = await browserTailwindHTMLToSceneGraph(
  `<article class="${classes.join(' ')}">OpenPencil</article>`,
  classes,
  {
    css: '@import "tailwindcss";',
    loadStylesheet: async (id) => {
      const url = id === 'tailwindcss' ? '/tailwindcss/index.css' : `/tailwindcss/${id}`
      return fetch(url).then((response) => response.text())
    },
    sandbox: 'iframe'
  }
)
```

### Bun/Node recipe

In Bun or Node, the package can load Tailwind's default stylesheet through filesystem-backed module resolution. Without a DOM, this uses the headless CSS runtime; pass a browser runtime only when the process has a real `document` available, such as Playwright or a browser extension page:

```ts
import { tailwindHTMLToSceneGraph } from '@open-pencil/dom-css'

const classes = ['flex', 'w-80', 'p-6', 'rounded-xl', 'bg-white']
const graph = await tailwindHTMLToSceneGraph(
  `<article class="${classes.join(' ')}">OpenPencil</article>`,
  classes
)
```

`compileTailwindCSS()` remains available when callers want to manage CSS compilation and runtime selection themselves.

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
- Map more computed CSS properties to scene graph fields through browser-native computed style or dependency-backed parsers: richer shadows, typography details, position constraints, borders, gradients, and grid once OpenPencil's grid support matures
- Improve SceneGraph → CSS export so generated HTML/CSS is useful for JSX, Tailwind, and web export
- Keep `@open-pencil/dom-css` stable before splitting lower-level file-format packages such as future `@open-pencil/kiwi` and `@open-pencil/fig`
