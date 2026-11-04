# @open-pencil/html-engine

HTML laid out as a browser lays it out, without a browser: [Blitz](https://github.com/DioxusLabs/blitz) (Stylo for style, Taffy for layout, Parley for text) compiled to WebAssembly. It captures every node's border box, the computed styles that differ from their initial values, inline boxes on each line, and text lines with their runs.

```ts
import { loadHTMLEngine } from '@open-pencil/html-engine'

const engine = await loadHTMLEngine()
engine.addFont(await Bun.file('Inter.ttf').bytes())
engine.setGenericFamily('sans-serif', ['Inter'])

const capture = await engine.layout(html, {
  baseURL: 'https://example.com/',
  viewport: { width: 1440, height: 900 },
  fetch: async (url) => {
    const response = await fetch(url)
    return response.ok ? { url: response.url, bytes: await response.bytes() } : null
  }
})
```

The engine fetches nothing itself: the host answers each stylesheet, font, and image the document asks for, or declines it. Raster images are laid out at their pixel size, read from their headers. The engine has no fonts of its own, so the host registers the ones layout may use.

The module, `wasm/html-engine.wasm`, is built from the Rust crate in `crate/` by `bun run build`, which needs Rust; rustup installs the toolchain `rust-toolchain.toml` pins. A host that serves the module somewhere other than beside this package sets `setHTMLEngineLocator`. `THIRD-PARTY-NOTICES.md` lists the licenses of the Rust crates compiled into it.
