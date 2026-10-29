import * as v from 'valibot'

import type { VariableType } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

import type { FigmaVariableValue } from '#core/figma-api'
import { defineTool } from '#core/tools/schema'

/** A parsed value as `setValueForMode` takes it; a colour gets a copy of its own. */
function figmaValue(value: ToolValue): FigmaVariableValue {
  return typeof value === 'object' ? { ...value } : value
}

type ToolValue = Color | number | string | boolean

function parseVariableValue(type: VariableType, value: string): ToolValue {
  if (type === 'COLOR') return parseColor(value)
  if (type === 'FLOAT') return Number(value)
  if (type === 'BOOLEAN') return value === 'true'
  return value
}

export const createVariable = defineTool({
  name: 'create_variable',

  description: 'Create a new variable in a collection.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
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
    // The value is checked first, so a value the variable cannot hold creates nothing.
    const value = args.value === undefined ? undefined : parseVariableValue(type, args.value)
    if (typeof value === 'number' && !Number.isFinite(value))
      return { error: `"${args.value}" is not a number` }
    const variable = figma.variables.createVariable(args.name, args.collection_id, type)
    if (value !== undefined) {
      for (const modeId of Object.keys(variable.valuesByMode))
        variable.setValueForMode(modeId, figmaValue(value))
    }
    return figma.graph.variables.get(variable.id)
  }
})

export const setVariable = defineTool({
  name: 'set_variable',

  description: 'Set the value of a variable for a specific mode.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.strictObject({
    id: v.pipe(v.string(), v.description('Variable ID')),
    mode: v.pipe(v.string(), v.description('Mode ID')),
    value: v.pipe(v.string(), v.description('Value (hex for COLOR, number for FLOAT, etc.)'))
  }),
  execute: (figma, args) => {
    const variable = figma.variables.getVariableById(args.id)
    if (!variable) return { error: `Variable "${args.id}" not found` }
    const parsedValue = parseVariableValue(variable.resolvedType, args.value)
    variable.setValueForMode(args.mode, figmaValue(parsedValue))
    return { id: args.id, mode: args.mode, value: parsedValue }
  }
})

export const deleteVariable = defineTool({
  name: 'delete_variable',

  description: 'Delete a variable.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    id: v.pipe(v.string(), v.description('Variable ID'))
  }),
  execute: (figma, { id }) => {
    const variable = figma.variables.getVariableById(id)
    if (!variable) return { error: `Variable "${id}" not found` }
    variable.remove()
    return { deleted: id }
  }
})
