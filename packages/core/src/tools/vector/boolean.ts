import * as v from 'valibot'

import type { FigmaAPI } from '#core/figma-api'
import { defineTool, nodeSummary, requireNodes, toolFailure } from '#core/tools/schema'

/** Combines the layers in the first one's parent, as Figma's boolean methods do. */
function booleanOf(
  figma: FigmaAPI,
  ids: readonly string[],
  operation: 'union' | 'subtract' | 'intersect' | 'exclude'
) {
  const nodes = requireNodes(figma, ids)
  if (!nodes) return { error: 'One or more node IDs were not found' }
  try {
    return nodeSummary(figma[operation](nodes, nodes[0].parent ?? figma.currentPage))
  } catch (error) {
    return toolFailure(error)
  }
}

export const booleanOperation = defineTool({
  name: 'boolean',

  description:
    'Combine two or more nodes into a boolean group: union, subtract (the first minus the rest), intersect, or exclude.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    op: v.pipe(
      v.picklist(['union', 'subtract', 'intersect', 'exclude']),
      v.description('Boolean operation')
    ),
    ids: v.pipe(v.array(v.string()), v.minLength(2), v.description('Node IDs, first one on top'))
  }),
  execute: (figma, { op, ids }) => booleanOf(figma, ids, op)
})
