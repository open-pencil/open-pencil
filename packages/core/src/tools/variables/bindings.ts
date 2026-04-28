import { defineTool } from '#core/tools/schema'

export const bindVariable = defineTool({
  name: 'bind_variable',
  mutates: true,
  description: 'Bind a variable to a node property (fills, strokes, opacity, width, height, etc.).',
  params: {
    node_id: { type: 'string', description: 'Node ID', required: true },
    field: {
      type: 'string',
      description: 'Property field (fills, strokes, opacity, width, height, etc.)',
      required: true,
    },
    variable_id: { type: 'string', description: 'Variable ID', required: true },
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.node_id)
    if (!node) return { error: `Node "${args.node_id}" not found` }
    const variable = figma.getVariableById(args.variable_id)
    if (!variable) return { error: `Variable "${args.variable_id}" not found` }
    figma.bindVariable(args.node_id, args.field, args.variable_id)
    return { node_id: args.node_id, field: args.field, variable_id: args.variable_id }
  },
})
