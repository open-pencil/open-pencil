# @open-pencil/html-engine

HTML laid out as a browser lays it out, without a browser: [Blitz](https://github.com/DioxusLabs/blitz) (Stylo for style, Taffy for layout, Parley for text) compiled to WebAssembly. It captures every element's border box and computed styles (properties with a fixed initial value only when they differ from it, and always the ones whose initial value depends on the element or is inherited, such as `display`, `color`, sizes, and fonts), an inline element's boxes on each line, the text lines its text sets with their runs, and the text of every text node.

```ts
import { loadHTMLEngine } from '@open-pencil/html-engine'

const engine = await loadHTMLEngine()
engine.addFont(await Bun.file('Inter.ttf').bytes())
engine.setGenericFamily('sans-serif', ['Inter'])

const capture = await engine.layout(html, {
  baseURL: 'https://example.com/',
  viewport: { width: 1440, height: 900 },
  // The engine aborts `signal` when a request runs past its deadline.
  fetch: async (url, signal) => {
    const response = await fetch(url, { signal })
    return response.ok ? { url: response.url, bytes: await response.bytes() } : null
  }
})
```

The engine fetches nothing itself: the host answers each stylesheet, font, and image the document asks for, or declines it. Raster images are laid out at their pixel size, read from their headers. The engine has no fonts of its own, so the host registers the ones layout may use.

The module, `wasm/html-engine.wasm`, is built from the Rust crate in `crate/` by `bun run build`, which needs Rust; rustup installs the toolchain `rust-toolchain.toml` pins. A host that serves the module somewhere other than beside this package sets `setHTMLEngineLocator`. The published package carries `wasm/THIRD-PARTY-NOTICES.md`, which the release writes with the licenses and sources of the Rust crates compiled into the module.
