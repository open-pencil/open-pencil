import * as v from 'valibot'

import { defineTool, nodeSummary, requireNodes } from '#core/tools/schema'

const nodeIdsSchema = (action: string) =>
  v.pipe(v.array(v.string()), v.minLength(1), v.description(`Node IDs to ${action}`))

export const deleteNodes = defineTool({
  name: 'delete_nodes',

  description: 'Delete nodes by ID. Nothing is deleted unless every node exists.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({ ids: nodeIdsSchema('delete') }),
  execute: (figma, { ids }) => {
    const nodes = requireNodes(figma, ids)
    if (!nodes) return { error: 'One or more node IDs were not found' }
    // A node inside another one deleted earlier went with it.
    for (const node of nodes) if (figma.getNodeById(node.id)) node.remove()
    return { deleted: ids }
  }
})

export const cloneNodes = defineTool({
  name: 'clone_nodes',

  description: 'Clone (duplicate) nodes, each beside its original.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({ ids: nodeIdsSchema('clone') }),
  execute: (figma, { ids }) => {
    const nodes = requireNodes(figma, ids)
    if (!nodes) return { error: 'One or more node IDs were not found' }
    return { clones: nodes.map((node) => nodeSummary(node.clone())) }
  }
})
