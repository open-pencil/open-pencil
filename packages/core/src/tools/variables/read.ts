import * as v from 'valibot'

import { defineTool } from '#core/tools/schema'

export const listVariables = defineTool({
  name: 'list_variables',
  description: 'List all design variables (colors, numbers, strings, booleans).',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.strictObject({
    type: v.optional(
      v.pipe(
        v.picklist(['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']),
        v.description('Filter by variable type')
      )
    )
  }),
  execute: (figma, args) => {
    const variables = figma.getLocalVariables(args.type)
    return { count: variables.length, variables }
  }
})

export const getVariable = defineTool({
  name: 'get_variable',
  description: 'Get a variable by ID.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.strictObject({
    id: v.pipe(v.string(), v.description('Variable ID'))
  }),
  execute: (figma, { id }) => {
    const variable = figma.getVariableById(id)
    if (!variable) return { error: `Variable "${id}" not found` }
    return variable
  }
})

export const findVariables = defineTool({
  name: 'find_variables',
  description: 'Find variables by name pattern.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.strictObject({
    query: v.pipe(v.string(), v.description('Name substring (case-insensitive)')),
    type: v.optional(
      v.pipe(v.picklist(['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']), v.description('Filter by type'))
    )
  }),
  execute: (figma, args) => {
    let variables = figma.getLocalVariables(args.type)
    variables = variables.filter((variable) =>
      variable.name.toLowerCase().includes(args.query.toLowerCase())
    )
    return { count: variables.length, variables }
  }
})
