import * as v from 'valibot'

import { toolNumber } from '#core/tools/input'
import { defineTool } from '#core/tools/schema'

import { autoDepth, describeOneNode } from './tree'

export const describe = defineTool({
  name: 'describe',
  description:
    'Semantic description of one or more nodes. Pass `id` for a single node, or `ids` for multiple nodes in one call. Omit depth for auto — adapts to subtree size (small block → deeper, large page → shallower).',
  execution: { kind: 'sync', mutation: 'none' },
  exposure: { webmcp: false },
  input: v.strictObject({
    id: v.optional(v.pipe(v.string(), v.description('Node ID (single node)'))),
    ids: v.optional(
      v.pipe(
        v.array(v.string()),
        v.minLength(1),
        v.description('Node IDs (multiple nodes in one call)')
      )
    ),
    depth: v.optional(
      toolNumber(v.pipe(v.number(), v.description('Override depth (auto if omitted, max: 5)')))
    ),
    grid: v.optional(
      toolNumber(v.pipe(v.number(), v.description('Grid size for alignment checks (default: 8)')))
    )
  }),
  execute: (figma, args) => {
    const gridSize = args.grid ?? 8

    if (args.ids && Array.isArray(args.ids)) {
      return {
        nodes: args.ids.map((nodeId) => {
          const depth = Math.min(args.depth ?? autoDepth(figma.graph, nodeId), 5)
          return describeOneNode(figma, nodeId, depth, gridSize)
        })
      }
    }

    if (!args.id) return { error: 'Provide id (string) or ids (string[])' }
    const depth = Math.min(args.depth ?? autoDepth(figma.graph, args.id), 5)
    return describeOneNode(figma, args.id, depth, gridSize)
  }
})
