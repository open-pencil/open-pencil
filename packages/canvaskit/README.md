# @open-pencil/canvaskit

[CanvasKit](https://skia.org/docs/user/modules/canvaskit/), Skia in WebAssembly, as OpenPencil builds it: CanvasKit 0.41.1's full build (WebGL, Skottie, paragraphs, PNG/JPEG/WebP encoders) with these additions:

- **`PDFDocument`**: Skia's PDF backend. Each page is an ordinary `Canvas`, so anything drawn to a surface can be drawn to a PDF page. Fonts are subset and embedded, text stays searchable, and effects PDF cannot express are drawn as images at the document's raster DPI.
- **Text keeps its characters** through shaping: Arabic joining forms and ligatures in a PDF map back to the text they draw.
- **Variable fonts embed as the instance they draw**, as TrueType rather than Type3 outlines.
- **`ImageFilter.MakeRuntimeShader`**: a runtime shader effect as an image filter, sampling its input or, as a `saveLayer` backdrop filter, the backdrop. Under a scaled or rotated canvas it runs once per device pixel, with its coordinates still in the filter's own units, where upstream Skia runs it at those units' resolution and stretches the result.
- **`ImageFilter.MakeRuntimeShaderWithInputs`**: the same with several inputs, each bound to one of the effect's uniform shaders by name, plus uniform shaders bound to shaders as they are, so an image of exact values, such as a half-float map, reaches the effect without being converted to the layer's color type.

The API and types are otherwise CanvasKit's.

```js
import CanvasKitInit from '@open-pencil/canvaskit'

const ck = await CanvasKitInit({ locateFile: (file) => `/assets/${file}` })
const doc = new ck.PDFDocument('Title', 'My app', 144)
const canvas = doc.beginPage(595, 842)
// ... draw ...
doc.endPage()
const bytes = doc.close()
doc.delete()
```

Serve `canvaskit.wasm` (import `@open-pencil/canvaskit/dist/canvaskit.wasm`) and point `locateFile` at it.

## Where it comes from

The patches are commits on the `openpencil/canvaskit` branch of [open-pencil/skia](https://github.com/open-pencil/skia/tree/openpencil/canvaskit), listed in its `OPENPENCIL.md`. Every push to that branch builds CanvasKit and releases it as `canvaskit-<commit>`. `release.json` pins one release, by commit and the SHA-256 of each file, and `bun install` (the workspace's `postinstall`) or this package's `build` fetches it into `dist/`. Nothing here is built locally.

To change CanvasKit, push to the fork's branch, wait for its release, and put the commit and the hashes from its `SHA256SUMS` in `release.json`.

The package is Skia, under Skia's BSD-3-Clause license (`LICENSE`); `dist/THIRD-PARTY-NOTICES.md` carries the licenses of the libraries compiled into it.
