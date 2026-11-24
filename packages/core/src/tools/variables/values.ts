import * as v from 'valibot'

import { VARIABLE_TYPES, type ColorProfile, type VariableType } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'
import { parseCSSEasing, parseCSSTime } from '@open-pencil/scene-graph/css'

import type { FigmaVariableValue } from '#core/figma-api'
import { figmaEasing, isFigmaEasingType } from '#core/figma-api/variables/easing'
import { graphOf } from '#core/figma-api/graph'
import { defineTool } from '#core/tools/schema'

const VALUE_FORMATS =
  'hex for COLOR, a number for FLOAT, true or false for BOOLEAN, 250ms or 0.25s for TIMING, and for EASING a preset (EASE_IN, EASE_OUT, EASE_IN_AND_OUT, LINEAR, EASE_IN_BACK, EASE_OUT_BACK, EASE_IN_AND_OUT_BACK, GENTLE, QUICK, BOUNCY, SLOW, HOLD) or a CSS cubic-bezier()'

/** A tool's text as the value `setValueForMode` takes for this type, or why it is not one. */
function parseVariableValue(
  type: VariableType,
  value: string,
  profile: ColorProfile
): { value: FigmaVariableValue } | { error: string } {
  if (type === 'COLOR') return { value: parseColor(value, profile) }
  if (type === 'BOOLEAN') return { value: value === 'true' }
  if (type === 'STRING') return { value }
  if (type === 'FLOAT') {
    const number = Number(value)
    return Number.isFinite(number) ? { value: number } : { error: `"${value}" is not a number` }
  }
  if (type === 'TIMING') {
    const seconds = parseCSSTime(value)
    return seconds === null
      ? { error: `"${value}" is not a time such as 250ms or 0.25s` }
      : { value: seconds }
  }
  const name = value.trim().toUpperCase()
  if (isFigmaEasingType(name)) return { value: { type: name } }
  const easing = parseCSSEasing(value)
  return easing
    ? { value: figmaEasing(easing) }
    : { error: `"${value}" is not an easing preset or a CSS cubic-bezier()` }
}

export const createVariable = defineTool({
  name: 'create_variable',

  description: 'Create a new variable in a collection.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    name: v.pipe(v.string(), v.description('Variable name')),
    type: v.pipe(
      v.picklist(VARIABLE_TYPES),
      v.description('Variable type')
    ),
    collection_id: v.pipe(v.string(), v.description('Collection ID')),
    value: v.optional(
      v.pipe(v.string(), v.description(`Initial value: ${VALUE_FORMATS}`))
    )
  }),
  execute: (figma, args) => {
    // The value is checked first, so a value the variable cannot hold creates nothing.
    const parsed =
      args.value === undefined
        ? undefined
        : parseVariableValue(args.type, args.value, graphOf(figma).documentColorSpace)
    if (parsed && 'error' in parsed) return parsed
    const variable = figma.variables.createVariable(args.name, args.collection_id, args.type)
    if (parsed) {
      for (const modeId of Object.keys(variable.valuesByMode))
        variable.setValueForMode(modeId, parsed.value)
    }
    return graphOf(figma).variables.get(variable.id)
  }
})

export const setVariable = defineTool({
  name: 'set_variable',

  description: 'Set the value of a variable for a specific mode.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.strictObject({
    id: v.pipe(v.string(), v.description('Variable ID')),
    mode: v.pipe(v.string(), v.description('Mode ID')),
    value: v.pipe(v.string(), v.description(`Value: ${VALUE_FORMATS}`))
  }),
  execute: (figma, args) => {
    const variable = figma.variables.getVariableById(args.id)
    if (!variable) return { error: `Variable "${args.id}" not found` }
    const parsed = parseVariableValue(
      variable.resolvedType,
      args.value,
      graphOf(figma).documentColorSpace
    )
    if ('error' in parsed) return parsed
    variable.setValueForMode(args.mode, parsed.value)
    return { id: args.id, mode: args.mode, value: parsed.value }
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
