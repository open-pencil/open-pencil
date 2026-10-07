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

Components that behave as controls are written with Reka UI's element names, and export writes them back the same way:

```tsx
<Switch.Root name="Switch" modelValue="State">
  <Component name="State=Off" w={44} h={24}><Switch.Thumb x={2} y={2} w={20} h={20} /></Component>
  <Component name="State=On" w={44} h={24}><Switch.Thumb x={22} y={2} w={20} h={20} /></Component>
</Switch.Root>
```

This package depends only on `@open-pencil/scene-graph` and `@open-pencil/emit`. Rendering needs icons, SVG conversion, and layout, which `@open-pencil/core/design-jsx` provides; other engines can supply their own through `createDesignJSXRenderer(services)`.
