import * as v from 'valibot'

import { defineTool } from '#core/tools/schema'

export const nodeReplaceWith = defineTool({
  name: 'node_replace_with',

  description: 'Replace a node with JSX content.',
  execution: { kind: 'async', mutation: 'document' },
  input: v.object({
    id: v.pipe(v.string(), v.description('Node ID to replace')),
    jsx: v.pipe(v.string(), v.description('JSX string for the replacement'))
  }),
  execute: async (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    const parentId = node.parent?.id ?? figma.currentPageId
    const x = node.x
    const y = node.y
    node.remove()
    const { designJSXRenderer } = await import('#core/design-jsx')
    const { renderJSX } = designJSXRenderer(figma.icons)
    const results = await renderJSX(figma.graph, args.jsx, { parentId, x, y })
    const result = results[0]
    return {
      id: result.id,
      name: result.name,
      type: result.type,
      ...(result.warnings ? { warnings: result.warnings } : {}),
      children: results
        .slice(1)
        .map((child) => ({ id: child.id, name: child.name, type: child.type }))
    }
  }
})
