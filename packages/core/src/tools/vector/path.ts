import { cloneVectorNetwork } from '#core/scene-graph'
import { defineTool } from '#core/tools/schema'

import type { FigmaAPI } from '#core/figma-api'
import type { SceneNode, VectorNetwork } from '#core/scene-graph'

function getVectorNode(
  figma: FigmaAPI,
  id: string
): { node: SceneNode; vn: VectorNetwork } | { error: string } {
  const node = figma.graph.getNode(id)
  if (!node) return { error: `Node "${id}" not found` }
  if (!node.vectorNetwork) return { error: `Node "${id}" has no vector data` }
  return { node, vn: cloneVectorNetwork(node.vectorNetwork) }
}

export const pathGet = defineTool({
  name: 'path_get',
  description: 'Get vector path data of a node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true }
  },
  execute: (figma, { id }) => {
    const raw = figma.graph.getNode(id)
    if (!raw) return { error: `Node "${id}" not found` }
    const vectorNetwork = raw.vectorNetwork
    return vectorNetwork ? { id, vectorNetwork } : { error: `Node "${id}" has no vector data` }
  }
})

export const pathSet = defineTool({
  name: 'path_set',
  mutates: true,
  description: 'Set vector path data on a node. Provide a VectorNetwork JSON.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    path: { type: 'string', description: 'VectorNetwork JSON', required: true }
  },
  execute: (figma, args) => {
    const raw = figma.graph.getNode(args.id)
    if (!raw) return { error: `Node "${args.id}" not found` }
    const network = JSON.parse(args.path)
    figma.graph.updateNode(args.id, { vectorNetwork: network })
    return { id: args.id }
  }
})

export const pathScale = defineTool({
  name: 'path_scale',
  mutates: true,
  description: 'Scale vector path from center.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    factor: { type: 'number', description: 'Scale factor (e.g. 2 for double)', required: true }
  },
  execute: (figma, { id, factor }) => {
    const result = getVectorNode(figma, id)
    if ('error' in result) return result
    const { node: raw, vn } = result
    const centerX = raw.width / 2
    const centerY = raw.height / 2
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

    figma.graph.updateNode(id, { vectorNetwork: vn })
    return { id, factor }
  }
})

export const pathFlip = defineTool({
  name: 'path_flip',
  mutates: true,
  description: 'Flip vector path horizontally or vertically.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    axis: {
      type: 'string',
      description: 'Flip axis',
      required: true,
      enum: ['horizontal', 'vertical']
    }
  },
  execute: (figma, { id, axis }) => {
    const result = getVectorNode(figma, id)
    if ('error' in result) return result
    const { node: raw, vn } = result
    const width = raw.width
    const height = raw.height
    for (const vertex of vn.vertices) {
      if (axis === 'horizontal') vertex.x = width - vertex.x
      else vertex.y = height - vertex.y
    }
    for (const segment of vn.segments) {
      if (axis === 'horizontal') segment.tangentStart.x = -segment.tangentStart.x
      else segment.tangentStart.y = -segment.tangentStart.y
      if (axis === 'horizontal') segment.tangentEnd.x = -segment.tangentEnd.x
      else segment.tangentEnd.y = -segment.tangentEnd.y
    }

    figma.graph.updateNode(id, { vectorNetwork: vn })
    return { id, axis }
  }
})

export const pathMove = defineTool({
  name: 'path_move',
  mutates: true,
  description: 'Move all path points by an offset.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    dx: { type: 'number', description: 'X offset', required: true },
    dy: { type: 'number', description: 'Y offset', required: true }
  },
  execute: (figma, { id, dx, dy }) => {
    const result = getVectorNode(figma, id)
    if ('error' in result) return result
    const { vn } = result
    for (const vertex of vn.vertices) {
      vertex.x += dx
      vertex.y += dy
    }

    figma.graph.updateNode(id, { vectorNetwork: vn })
    return { id, dx, dy }
  }
})
