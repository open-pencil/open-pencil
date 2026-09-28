import * as v from 'valibot'

import type { VariableType, VariableValue } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'

import { defineTool } from '#core/tools/schema'

function parseVariableValue(type: VariableType, value: string): VariableValue {
  if (type === 'COLOR') return parseColor(value)
  if (type === 'FLOAT') return Number(value)
  if (type === 'BOOLEAN') return value === 'true'
  return value
}

export const createVariable = defineTool({
  name: 'create_variable',

  description: 'Create a new variable in a collection.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.object({
    name: v.pipe(v.string(), v.description('Variable name')),
    type: v.pipe(
      v.picklist(['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']),
      v.description('Variable type')
    ),
    collection_id: v.pipe(v.string(), v.description('Collection ID')),
    value: v.optional(
      v.pipe(v.string(), v.description('Initial value (hex for COLOR, number for FLOAT, etc.)'))
    )
  }),
  execute: (figma, args) => {
    const type = args.type as VariableType
    const parsedValue = args.value === undefined ? undefined : parseVariableValue(type, args.value)
    return figma.createVariable(args.name, type, args.collection_id, parsedValue)
  }
})

export const setVariable = defineTool({
  name: 'set_variable',

  description: 'Set the value of a variable for a specific mode.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.object({
    id: v.pipe(v.string(), v.description('Variable ID')),
    mode: v.pipe(v.string(), v.description('Mode ID')),
    value: v.pipe(v.string(), v.description('Value (hex for COLOR, number for FLOAT, etc.)'))
  }),
  execute: (figma, args) => {
    const variable = figma.getVariableById(args.id)
    if (!variable) return { error: `Variable "${args.id}" not found` }
    const parsedValue = parseVariableValue(variable.type, args.value)
    figma.setVariableValue(args.id, args.mode, parsedValue)
    return { id: args.id, mode: args.mode, value: parsedValue }
  }
})

export const deleteVariable = defineTool({
  name: 'delete_variable',

  description: 'Delete a variable.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.object({
    id: v.pipe(v.string(), v.description('Variable ID'))
  }),
  execute: (figma, { id }) => {
    figma.deleteVariable(id)
    return { deleted: id }
  }
})
