import * as v from 'valibot'

import type { VariableType } from '@open-pencil/scene-graph'

import type { FigmaAPI } from '#core/figma-api'
import { defineTool } from '#core/tools/schema'

/** The document's variables as tools report them, of one type or all. */
function documentVariables(figma: FigmaAPI, type?: VariableType) {
  return figma.variables.getLocalVariables(type).flatMap((variable) => {
    const record = figma.graph.variables.get(variable.id)
    return record ? [record] : []
  })
}

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
    const variables = documentVariables(figma, args.type)
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
    const variable = figma.graph.variables.get(id)
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
    const variables = documentVariables(figma, args.type).filter((variable) =>
      variable.name.toLowerCase().includes(args.query.toLowerCase())
    )
    return { count: variables.length, variables }
  }
})
