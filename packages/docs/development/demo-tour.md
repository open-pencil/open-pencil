# Demo tour

The `/demo` document is a tour of eight chapters on one page, each a section stacked top to bottom. It is built from `tools/generate/demo/src/document/` and lives only in OpenPencil Cloud's community gallery: the **Publish gallery examples** workflow builds and publishes it (see `cloud.md`), and the app and the docs landing download it from the official server's gallery and open it like any `.fig` file. The app has no copy of its own, and the tour is never generated in the browser.

## Document structure

- `theme.ts` defines the Theme and App chrome collections, each with a Dark and a Light mode. Every color in the tour, icons included, is bound to them, and `src/app/demo/theme.ts` switches the modes by name so the tour follows the app's theme.
- `callout.tsx` defines the Tip component every chapter instances. Each chapter fills its Where slot with a piece of the app from `chrome.tsx`, drawn to the dark theme's tokens with the target ringed.
- `player/` holds the player card, its artwork slot, and its controls with behaviours.
- `chapters/` holds one file per chapter. `chapters/chapter.ts` lays each out as numeral, heading, subject, and tip, and `chapters/names.ts` names each section and subject; hosts outside the app, such as the docs landing, import those names from `@open-pencil/demo-tools/chapters`.
- `src/app/demo/viewport.ts` opens the tour on the first chapter.

## Building

The tour renders design JSX through `document/icons.ts`, which serves Lucide from the bundled icon JSON, so the build needs no Iconify API.

`buildDemoDocument` (`tools/generate/demo/src/build.ts`) returns the tour's bytes; the publishing tool calls it. To look at a change locally, `bun run generate:demo <output.fig>` writes the tour to a file to open in the editor.

The app opens the tour through `fetchOfficialTour` (`src/app/cloud/community/tour.ts`), which asks the official server for the gallery document its `[community] tour` names, as the version named for the app's release when there is one, else as it is now (`fetchCommunityTour` in `@open-pencil/cloud/client`). A build without Cloud has no tour.

## Shader stills

Shader fills get their still frames from `tools/generate/demo/src/shaders/stills.ts`, which draws each preset in the Playwright Chromium with WebGPU, at the size and in the encoding the editor uses (`shaderFramePixels` and `shaderFrameEncoding` from `@open-pencil/scene-graph`). Install the browser locally with `bunx playwright install chromium`; the deploy and preview workflows install it. Without the browser, the build skips the stills. The editor then draws the frames when the demo opens, but only in a browser with WebGPU; elsewhere those shader fills stay without a frame. The publishing workflow installs the browser, so the published tour has its stills.
