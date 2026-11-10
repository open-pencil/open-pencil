import {
  nodeTraversalInput,
  nodeInputSchema,
  defineTool,
  getRawNodeOrError,
  nodeSummary
} from '#core/tools/schema'

export const nodeAncestors = defineTool({
  name: 'node_ancestors',
  description: 'Get the ancestor chain from a node to the page root.',
  execution: { kind: 'sync', mutation: 'none' },
  exposure: { webmcp: false },
  input: nodeTraversalInput('Max depth to traverse'),
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
  }
})

export const nodeBindings = defineTool({
  name: 'node_bindings',
  description: 'Get variable bindings for a node.',
  execution: { kind: 'sync', mutation: 'none' },
  exposure: { webmcp: false },
  input: nodeInputSchema,
  execute: (figma, { id }) => {
    const result = getRawNodeOrError(figma, id)
    if ('error' in result) return result
    return { id, bindings: result.node.boundVariables }
  }
})
