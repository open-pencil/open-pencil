import * as v from 'valibot'

import type { VariableType } from '@open-pencil/scene-graph'

import type { FigmaAPI } from '#core/figma-api'
import { graphOf } from '#core/figma-api/graph'
import { defineTool } from '#core/tools/schema'

/** The document's variables as tools report them, of one type or all. */
function documentVariables(figma: FigmaAPI, type?: VariableType) {
  return figma.variables.getLocalVariables(type).flatMap((variable) => {
    const record = graphOf(figma).variables.get(variable.id)
    return record ? [record] : []
  })
}

export const listVariables = defineTool({
  name: 'list_variables',
  description: 'List design variables (colors, numbers, strings, booleans), optionally by name.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.strictObject({
    query: v.optional(v.pipe(v.string(), v.description('Name substring (case-insensitive)'))),
    type: v.optional(
      v.pipe(
        v.picklist(['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']),
        v.description('Filter by variable type')
      )
    )
  }),
  execute: (figma, args) => {
    const query = args.query?.toLowerCase()
    const variables = documentVariables(figma, args.type).filter(
      (variable) => !query || variable.name.toLowerCase().includes(query)
    )
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
    const variable = graphOf(figma).variables.get(id)
    if (!variable) return { error: `Variable "${id}" not found` }
    return variable
  }
})
