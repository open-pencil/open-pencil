# @open-pencil/design-jsx

OpenPencil design JSX: build editable scene trees with `<Frame>`, `<Text>`, and the other elements, style them with paint and effect helpers and design variables, and export scene nodes back to JSX.

Set the JSX import source in `tsconfig.json` (`"jsx": "react-jsx"`, `"jsxImportSource": "@open-pencil/design-jsx"`) or per file:

```tsx
/** @jsxImportSource @open-pencil/design-jsx */
import { renderTree } from '@open-pencil/core/design-jsx'
import { Frame, Text, solid } from '@open-pencil/design-jsx'
import { SceneGraph } from '@open-pencil/scene-graph'

const graph = new SceneGraph()
await renderTree(
  graph,
  <Frame w={320} p={16} fill={solid('#FFFFFF')}>
    <Text>Hello</Text>
  </Frame>
)
```

JSX written as a string, as agents and the MCP `render` tool send it, needs no build step:

```ts
import { renderJSX } from '@open-pencil/core/design-jsx'

await renderJSX(graph, '<Frame w={320} p={16} bg="#FFFFFF"><Text>Hello</Text></Frame>')
```

This package depends only on `@open-pencil/scene-graph` and `@open-pencil/codegen`. Rendering needs icons, SVG conversion, and layout, which `@open-pencil/core/design-jsx` provides; other engines can supply their own through `createDesignJSXRenderer(services)`.
