# @open-pencil/taffy

[Taffy](https://github.com/DioxusLabs/taffy), the Rust flexbox and grid layout engine, compiled to WebAssembly as OpenPencil builds it. A tree of nodes with CSS styles goes to the module in one call and every box comes back in one read, instead of one call per property; leaves you measure, such as text, are measured through a callback on the way.

```js
import { computeLayout, LayoutNode } from '@open-pencil/taffy'

const row = new LayoutNode({ width: 300, height: 100 })
const icon = new LayoutNode({ width: 24 })
const label = new LayoutNode({ flexGrow: 1 })
label.measure = (known, available) => ({ width: known.width ?? 120, height: 20 })
row.append(icon)
row.append(label)

computeLayout(row)
label.layout // { left: 24, top: 0, width: 276, height: 100 }
```

Styles take CSS's names and initial values. `taffy.js` loads the module, `taffy.wasm`, from beside it before its exports are ready: a browser fetches it from `new URL('./taffy.wasm', import.meta.url)`, which Vite and other bundlers emit as an asset, and Node and Bun read it from disk. A bundler that pre-bundles dependencies in development, as Vite does with `optimizeDeps`, needs this package excluded there, since pre-bundling moves `taffy.js` away from `taffy.wasm`.

## Where it comes from

Taffy's source is the `openpencil/taffy` branch of [open-pencil/taffy](https://github.com/open-pencil/taffy/tree/openpencil/taffy): the Taffy commit Blitz pins, plus the fixes listed in its `OPENPENCIL.md` that wait on upstream. Its `openpencil/` folder holds the batched interface and this host. Every push to that branch builds them and releases them as `taffy-<commit>`; `release.json` pins one release, by tag and the SHA-256 of each file, and `bun install` (the workspace's `postinstall`) or this package's `build` fetches it into `dist/`. Nothing here is built locally.

To change it, push to the fork's branch, wait for its release, and run `bun run fork:pin packages/taffy taffy-<commit>`.

The package is Taffy, under Taffy's MIT license (`LICENSE`); `dist/THIRD-PARTY-NOTICES.md` carries the licenses of the crates compiled into it.
