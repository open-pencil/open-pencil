import { defineTool } from '#core/tools/schema'

export const listVariables = defineTool({
  name: 'list_variables',
  description: 'List all design variables (colors, numbers, strings, booleans).',
  params: {
    type: {
      type: 'string',
      description: 'Filter by variable type',
      enum: ['COLOR', 'FLOAT', 'STRING', 'BOOLEAN'],
    },
  },
  execute: (figma, args) => {
    const variables = figma.getLocalVariables(args.type)
    return { count: variables.length, variables }
  },
})

export const getVariable = defineTool({
  name: 'get_variable',
  description: 'Get a variable by ID.',
  params: {
    id: { type: 'string', description: 'Variable ID', required: true },
  },
  execute: (figma, { id }) => {
    const variable = figma.getVariableById(id)
    if (!variable) return { error: `Variable "${id}" not found` }
    return variable
  },
})

export const findVariables = defineTool({
  name: 'find_variables',
  description: 'Find variables by name pattern.',
  params: {
    query: { type: 'string', description: 'Name substring (case-insensitive)', required: true },
    type: {
      type: 'string',
      description: 'Filter by type',
      enum: ['COLOR', 'FLOAT', 'STRING', 'BOOLEAN'],
    },
  },
  execute: (figma, args) => {
    let variables = figma.getLocalVariables(args.type)
    variables = variables.filter((variable) =>
      variable.name.toLowerCase().includes(args.query.toLowerCase())
    )
    return { count: variables.length, variables }
  },
})
