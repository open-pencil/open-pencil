import * as v from 'valibot'

import { defineTool, nodeSummary, requireNodes } from '#core/tools/schema'

export const reparentNode = defineTool({
  name: 'reparent_node',

  description: 'Move a node into a different parent.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    id: v.pipe(v.string(), v.description('Node ID to move')),
    parent_id: v.pipe(v.string(), v.description('New parent node ID'))
  }),
  execute: (figma, { id, parent_id }) => {
    const node = figma.getNodeById(id)
    const parent = figma.getNodeById(parent_id)
    if (!node) return { error: `Node "${id}" not found` }
    if (!parent) return { error: `Parent "${parent_id}" not found` }
    parent.appendChild(node)
    return { id, parent_id }
  }
})

export const groupNodes = defineTool({
  name: 'group_nodes',

  description: 'Group selected nodes.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    ids: v.pipe(v.array(v.string()), v.minLength(2), v.description('Node IDs to group'))
  }),
  execute: (figma, { ids }) => {
    const nodes = requireNodes(figma, ids)
    if (!nodes || nodes.length < 2) return { error: 'Need at least 2 nodes to group' }
    const parent = nodes[0].parent ?? figma.currentPage
    const group = figma.group(nodes, parent)
    return nodeSummary(group)
  }
})

export const ungroupNode = defineTool({
  name: 'ungroup_node',

  description: 'Ungroup a group node.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    id: v.pipe(v.string(), v.description('Group node ID'))
  }),
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    figma.ungroup(node)
    return { ungrouped: id }
  }
})

export const flattenNodes = defineTool({
  name: 'flatten_nodes',

  description: 'Flatten nodes into a single vector.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    ids: v.pipe(v.array(v.string()), v.minLength(1), v.description('Node IDs to flatten'))
  }),
  execute: (figma, { ids }) => {
    const result = figma.flattenNode(ids)
    return nodeSummary(result)
  }
})

export const nodeToComponent = defineTool({
  name: 'node_to_component',

  description: 'Convert one or more frames/groups into components.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    ids: v.pipe(v.array(v.string()), v.minLength(1), v.description('Node IDs to convert'))
  }),
  execute: (figma, { ids }) => {
    const results: { id: string; name: string; originalId: string }[] = []
    for (const id of ids) {
      const node = figma.getNodeById(id)
      if (!node) continue
      const comp = figma.createComponentFromNode(node)
      results.push({ id: comp.id, name: comp.name, originalId: id })
    }
    return { converted: results }
  }
})
