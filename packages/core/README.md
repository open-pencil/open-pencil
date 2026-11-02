# @lawha/core

Editor engine for [Lawha](https://github.com/aliaaldihnayn-lab/design#readme): the CanvasKit (Skia WASM) renderer, Yoga layout, the framework-agnostic editor with undo and selection, the Figma Plugin API compatibility layer, the AI/MCP tool definitions, clipboard and vector conversion, and format-neutral document I/O.

It depends on `@lawha/scene-graph`, `@lawha/pen`, `@lawha/kiwi`, and `@lawha/fig`, and keeps browser DOM out so it runs in the app, the CLI, the MCP server, and headless scripts alike.

The root entry is the editor: `createEditor` and its types. Everything else comes from the subpaths listed in `package.json` `exports`, for example `@lawha/core/io`, `@lawha/core/geometry`, and `@lawha/core/canvaskit`, and each name has exactly one of them.

Scripts get two globals through `compileScript` from `@lawha/core/tools`: `figma`, the Figma Plugin API over a document, and `lawha` (`LawhaAPI` from `@lawha/core/lawha-api`), what Lawha adds to it in the same style, such as making a component behave as a Reka UI control:

```ts
import { FigmaAPI } from '@lawha/core/figma-api'
import { compileScript } from '@lawha/core/tools'

await compileScript(`
  const set = figma.currentPage.findOne((n) => n.name === 'Switch')
  lawha.setBehaviour(set, { kind: 'switch', values: { value: 'State' } })
`)(new FigmaAPI(graph))
```

- Programmable overview and SDK docs: https://github.com/aliaaldihnayn-lab/design#readme
- Source and issues: https://github.com/aliaaldihnayn-lab/design

MIT License.
