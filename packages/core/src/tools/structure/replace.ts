import * as v from 'valibot'

import { finishRenderPlacement, resolveRenderPlacement } from '#core/design-jsx/placement'
import { graphOf } from '#core/figma-api/graph'
import { defineTool } from '#core/tools/schema'

export const nodeReplaceWith = defineTool({
  name: 'replace_node',

  description: 'Replace a node with JSX content.',
  execution: { kind: 'async', mutation: 'document' },
  input: v.strictObject({
    id: v.pipe(v.string(), v.description('Node ID to replace')),
    jsx: v.pipe(v.string(), v.description('JSX string for the replacement'))
  }),
  execute: async (figma, args) => {
    const { designJSXRenderer } = await graphOf(figma).waitOutsideEdit(import('#core/design-jsx'))
    if (!figma.getNodeById(args.id)) return { error: `Node "${args.id}" not found` }
    const graph = graphOf(figma)
    // As render's replace_id does: the original goes only once the replacement has rendered, so a
    // render that fails leaves it where it was.
    const placement = resolveRenderPlacement(graph, { replace_id: args.id }, figma.currentPageId)
    const { renderJSX } = designJSXRenderer(figma.icons)
    const results = await renderJSX(graph, args.jsx, placement)
    finishRenderPlacement(graph, results, placement)
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
