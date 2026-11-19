# Demo tour

The `/demo` document is a tour of eight chapters on one page, each a section stacked top to bottom. It is built at development and build time from `tools/generate/demo/src/document/` into the ignored `public/demo.fig`, which the app opens like any `.fig` file; it is never generated in the browser.

## Document structure

- `theme.ts` defines the Theme and App chrome collections, each with a Dark and a Light mode. Every color in the tour, icons included, is bound to them, and `src/app/demo/theme.ts` switches the modes by name so the tour follows the app's theme.
- `callout.tsx` defines the Tip component every chapter instances. Each chapter fills its Where slot with a piece of the app from `chrome.tsx`, drawn to the dark theme's tokens with the target ringed.
- `player/` holds the player card, its artwork slot, and its controls with behaviours.
- `chapters/` holds one file per chapter. `chapters/chapter.ts` lays each out as numeral, heading, subject, and tip, and `chapters/names.ts` names each section and subject; hosts outside the app, such as the docs landing, import those names from `@open-pencil/demo-tools/chapters`.
- `src/app/demo/viewport.ts` opens the tour on the first chapter.

## Building

The tour renders design JSX through `document/icons.ts`, which serves Lucide from the bundled icon JSON, so the build needs no Iconify API.

`ensureDemoDocument` runs from `vite.config.ts`. It rebuilds only when the fingerprint of its inputs changes and runs the build in Bun; `bun run generate:demo` forces a rebuild. A chapter that needs something new from the engine adds that package's `src` to the fingerprint in `tools/generate/demo/src/ensure.ts`.

## Shader stills

Shader fills get their still frames from `tools/generate/demo/src/shaders/stills.ts`, which draws each preset in the Playwright Chromium with WebGPU, at the size and in the encoding the editor uses (`shaderFramePixels` and `shaderFrameEncoding` from `@open-pencil/scene-graph`). Install the browser locally with `bunx playwright install chromium`; the deploy and preview workflows install it. Without the browser, the build skips the stills. The editor then draws the frames when the demo opens, but only in a browser with WebGPU; elsewhere those shader fills stay without a frame. `ensureDemoDocument` runs the build in a child process and does not show its warning.
