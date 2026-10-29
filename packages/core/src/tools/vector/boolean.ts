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

export const booleanUnion = defineTool({
  name: 'boolean_union',

  description: 'Union (combine) multiple nodes.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    ids: v.pipe(v.array(v.string()), v.minLength(2), v.description('Node IDs to union'))
  }),
  execute: (figma, { ids }) => {
    return booleanOf(figma, ids, 'union')
  }
})

export const booleanSubtract = defineTool({
  name: 'boolean_subtract',

  description: 'Subtract the second node from the first.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    ids: v.pipe(v.array(v.string()), v.minLength(2), v.description('Node IDs (first minus rest)'))
  }),
  execute: (figma, { ids }) => {
    return booleanOf(figma, ids, 'subtract')
  }
})

export const booleanIntersect = defineTool({
  name: 'boolean_intersect',

  description: 'Intersect multiple nodes.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    ids: v.pipe(v.array(v.string()), v.minLength(2), v.description('Node IDs to intersect'))
  }),
  execute: (figma, { ids }) => {
    return booleanOf(figma, ids, 'intersect')
  }
})

export const booleanExclude = defineTool({
  name: 'boolean_exclude',

  description: 'Exclude (XOR) multiple nodes.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    ids: v.pipe(v.array(v.string()), v.minLength(2), v.description('Node IDs to exclude'))
  }),
  execute: (figma, { ids }) => {
    return booleanOf(figma, ids, 'exclude')
  }
})
