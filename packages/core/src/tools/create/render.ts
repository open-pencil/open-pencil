import * as v from 'valibot'

import { finishRenderPlacement, resolveRenderPlacement } from '#core/design-jsx/placement'
import { toolNumber } from '#core/tools/input'
import { defineTool } from '#core/tools/schema'

export const render = defineTool({
  name: 'render',

  description:
    'Render JSX to design nodes. Supports inline SVG paths, including open stroked paths: <svg viewBox="0 0 24 24" size={24}><path d="M2 12 L22 12" stroke="#000" fill="none" /></svg>. Use replace_id to replace a placeholder while preserving its position.',
  execution: { kind: 'async', mutation: 'document' },
  input: v.strictObject({
    replace_id: v.optional(
      v.pipe(
        v.string(),
        v.description(
          'Node ID to replace — new node takes its position in parent, old node is deleted'
        )
      )
    ),
    parent_id: v.optional(v.pipe(v.string(), v.description('Parent node ID to render into'))),
    insert_index: v.optional(
      toolNumber(
        v.pipe(
          v.number(),
          v.description('Position among siblings (0 = first child). Omit to append at end.')
        )
      )
    ),
    x: v.optional(toolNumber(v.pipe(v.number(), v.description('X position of the root node')))),
    y: v.optional(toolNumber(v.pipe(v.number(), v.description('Y position of the root node')))),
    jsx: v.pipe(v.string(), v.description('JSX string to render'))
  }),
  execute: async (figma, args) => {
    const { designJSXRenderer } = await import('#core/design-jsx')
    const { renderJSX } = designJSXRenderer(figma.icons)

    const placement = resolveRenderPlacement(figma.graph, args, figma.currentPageId)
    const results = await renderJSX(figma.graph, args.jsx, placement)
    finishRenderPlacement(figma.graph, results, placement)
    const result = results[0]

    const response: {
      id: string
      name: string
      type: string
      children: string[]
      warnings?: typeof result.warnings
      siblings?: Array<{ id: string; name: string; type: string }>
    } = {
      id: result.id,
      name: result.name,
      type: result.type,
      children: result.childIds
    }
    if (result.warnings) response.warnings = result.warnings
    if (results.length > 1) {
      response.siblings = results
        .slice(1)
        .map((node) => ({ id: node.id, name: node.name, type: node.type }))
    }
    return response
  }
})
