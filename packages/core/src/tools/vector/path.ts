import * as v from 'valibot'

import type { SceneNode, VectorNetwork } from '@open-pencil/scene-graph'
import { cloneVectorNetwork } from '@open-pencil/scene-graph/copy'

import type { FigmaAPI } from '#core/figma-api'
import { graphOf } from '#core/figma-api/graph'
import { defineTool, nodeIdInputSchema, nodeInputSchema, toolNumber } from '#core/tools/schema'
import { parseVectorNetworkJSON } from '#core/tools/vector/network'

function getVectorNode(
  figma: FigmaAPI,
  id: string
): { node: SceneNode; vn: VectorNetwork } | { error: string } {
  const node = graphOf(figma).getNode(id)
  if (!node) return { error: `Node "${id}" not found` }
  if (!node.vectorNetwork) return { error: `Node "${id}" has no vector data` }
  return { node, vn: cloneVectorNetwork(node.vectorNetwork) }
}

export const pathGet = defineTool({
  name: 'path_get',
  description: 'Get vector path data of a node.',
  execution: { kind: 'sync', mutation: 'none' },
  exposure: { webmcp: false },
  input: nodeInputSchema,
  execute: (figma, { id }) => {
    const raw = graphOf(figma).getNode(id)
    if (!raw) return { error: `Node "${id}" not found` }
    const vectorNetwork = raw.vectorNetwork
    return vectorNetwork ? { id, vectorNetwork } : { error: `Node "${id}" has no vector data` }
  }
})

export const pathSet = defineTool({
  name: 'path_set',

  description: 'Set vector path data on a node. Provide a VectorNetwork JSON.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    id: nodeIdInputSchema,
    path: v.pipe(v.string(), v.description('VectorNetwork JSON'))
  }),
  execute: (figma, args) => {
    const raw = graphOf(figma).getNode(args.id)
    if (!raw) return { error: `Node "${args.id}" not found` }
    const parsed = parseVectorNetworkJSON(args.path)
    if ('error' in parsed) return parsed
    graphOf(figma).updateNode(args.id, { vectorNetwork: parsed.network })
    return { id: args.id }
  }
})

/** Scales the points about the path's centre. */
function scalePath(vn: VectorNetwork, node: SceneNode, factor: number) {
  const centerX = node.width / 2
  const centerY = node.height / 2
  for (const vertex of vn.vertices) {
    vertex.x = centerX + (vertex.x - centerX) * factor
    vertex.y = centerY + (vertex.y - centerY) * factor
  }
  for (const segment of vn.segments) {
    segment.tangentStart.x *= factor
    segment.tangentStart.y *= factor
    segment.tangentEnd.x *= factor
    segment.tangentEnd.y *= factor
  }
}

/** Mirrors the points across the path's box. */
function flipPath(vn: VectorNetwork, node: SceneNode, axis: 'horizontal' | 'vertical') {
  for (const vertex of vn.vertices) {
    if (axis === 'horizontal') vertex.x = node.width - vertex.x
    else vertex.y = node.height - vertex.y
  }
  for (const segment of vn.segments) {
    if (axis === 'horizontal') {
      segment.tangentStart.x = -segment.tangentStart.x
      segment.tangentEnd.x = -segment.tangentEnd.x
    } else {
      segment.tangentStart.y = -segment.tangentStart.y
      segment.tangentEnd.y = -segment.tangentEnd.y
    }
  }
}

export const pathTransform = defineTool({
  name: 'path_transform',

  description:
    "Scale, flip, or move a vector node's path points, in that order, without changing the node's box.",
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    id: nodeIdInputSchema,
    scale: v.optional(
      toolNumber(v.pipe(v.number(), v.description('Scale factor from the centre, e.g. 2')))
    ),
    flip: v.optional(v.pipe(v.picklist(['horizontal', 'vertical']), v.description('Flip axis'))),
    move: v.optional(
      v.pipe(
        v.strictObject({ dx: toolNumber(), dy: toolNumber() }),
        v.description('Offset for every point')
      )
    )
  }),
  execute: (figma, { id, scale, flip, move }) => {
    if (scale === undefined && flip === undefined && move === undefined)
      return { error: 'Pass scale, flip, or move' }
    const result = getVectorNode(figma, id)
    if ('error' in result) return result
    const { node, vn } = result
    if (scale !== undefined) scalePath(vn, node, scale)
    if (flip !== undefined) flipPath(vn, node, flip)
    if (move !== undefined)
      for (const vertex of vn.vertices) {
        vertex.x += move.dx
        vertex.y += move.dy
      }
    graphOf(figma).updateNode(id, { vectorNetwork: vn })
    return { id, scale, flip, move }
  }
})
