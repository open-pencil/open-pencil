import { defineTool, getRawNodeOrError, nodeNotFound, nodeSummary } from '#core/tools/schema'

import type { FigmaNodeProxy } from '#core/figma-api'

export const nodeAncestors = defineTool({
  name: 'node_ancestors',
  description: 'Get the ancestor chain from a node to the page root.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    depth: { type: 'number', description: 'Max depth to traverse' },
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    const ancestors: { id: string; name: string; type: string }[] = []
    let current = node.parent
    let depth = 0
    while (current && (!args.depth || depth < args.depth)) {
      ancestors.push(nodeSummary(current))
      current = current.parent
      depth++
    }
    return { id: args.id, ancestors }
  },
})

export const nodeChildren = defineTool({
  name: 'node_children',
  description: 'Get direct children of a node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
  },
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return nodeNotFound(id)
    return { id, children: node.children.map(nodeSummary) }
  },
})

export const nodeTree = defineTool({
  name: 'node_tree',
  description: 'Get a node tree with types and hierarchy.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    depth: { type: 'number', description: 'Max depth (default: unlimited)' },
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    function buildTree(current: FigmaNodeProxy, depth: number): Record<string, unknown> {
      const result: Record<string, unknown> = {
        id: current.id,
        name: current.name,
        type: current.type,
      }
      if (args.depth === undefined || depth < args.depth) {
        const children = current.children
        if (children.length > 0) result.children = children.map((child) => buildTree(child, depth + 1))
      }
      return result
    }
    return buildTree(node, 0)
  },
})

export const nodeBindings = defineTool({
  name: 'node_bindings',
  description: 'Get variable bindings for a node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
  },
  execute: (figma, { id }) => {
    const result = getRawNodeOrError(figma, id)
    if ('error' in result) return result
    return { id, bindings: result.node.boundVariables }
  },
})
