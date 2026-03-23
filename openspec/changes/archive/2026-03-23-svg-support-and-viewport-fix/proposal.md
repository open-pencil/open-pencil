## Why

Two issues:
1. **Viewport center calculation ignores sidebars** — inserting components/images via double-click or context menu places them at `window.innerWidth/2` which doesn't account for the left (layers) and right (properties) panels. Result: items appear shifted to the right.
2. **SVG files are not supported** — dropping an SVG from the OS or pasting SVG markup does nothing. The codebase already has `extractPaths()` (in iconify.ts) which parses SVG shapes into `PathInfo[]`, `parseSVGPath()` which converts `d` attributes to `VectorNetwork`, and `createIconFromPaths()` which creates scene nodes. This pipeline just needs to be exposed for arbitrary SVG files.

## What Changes

- **Fix viewport center** — `canvasViewportCenter()` already added to store but not exported/used. Export it, use in `AssetItem`, `ImageAssetItem`, and `pasteFromHTML`. Replace all raw `window.innerWidth/2` center calculations.
- **SVG file drop from OS** — add `image/svg+xml` to accepted drop types in `use-canvas-drop.ts`. Parse dropped SVG file text, extract paths, create FRAME with VECTOR children using existing pipeline.
- **SVG in Assets panel** — SVG files dropped onto canvas are stored as image bytes in `graph.images`. Show them in the Images section alongside raster images.
- **Add `parseSVGFile()` to core** — extract the `extractPaths` + `parseSVGPath` + `buildIconData` pipeline into a reusable `parseSVGFile(svgText, size)` function that works on arbitrary SVG content (not just Iconify responses).

## Capabilities

### New Capabilities
- `svg-import`: SVG file drag-and-drop from OS, parsed into vector scene nodes

### Modified Capabilities
- `asset-panel`: Viewport center calculation uses actual canvas bounds, not window bounds
- `asset-images`: SVG files appear in Images section after being imported

## Impact

- `packages/core/src/iconify.ts` — extract `extractPaths` to a shared export, add `parseSVGFile()`
- `src/stores/editor.ts` — export `canvasViewportCenter`, add `placeSVGFile()`, fix all viewport center usages
- `src/components/AssetItem.vue` — use `canvasViewportCenter()`
- `src/components/ImageAssetItem.vue` — use `canvasViewportCenter()`
- `src/composables/use-canvas-drop.ts` — accept `image/svg+xml`, handle SVG files
