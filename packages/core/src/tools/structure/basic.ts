import * as v from 'valibot'

import { nodeInputSchema, defineTool, nodeNotFound, nodeSummary } from '#core/tools/schema'

export const deleteNode = defineTool({
  name: 'delete_node',

  description: 'Delete a node by ID.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    id: v.pipe(v.string(), v.description('Node ID to delete'))
  }),
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.remove()
    return { deleted: id }
  }
})

export const cloneNode = defineTool({
  name: 'clone_node',

  description: 'Clone (duplicate) a node.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    id: v.pipe(v.string(), v.description('Node ID to clone'))
  }),
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    const clone = node.clone()
    return nodeSummary(clone)
  }
})

export const nodeBounds = defineTool({
  name: 'node_bounds',
  description: 'Get absolute bounding box of a node.',
  execution: { kind: 'sync', mutation: 'none' },
  exposure: { webmcp: false },
  input: nodeInputSchema,
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    return node ? { id, bounds: node.absoluteBoundingBox } : nodeNotFound(id)
  }
})
