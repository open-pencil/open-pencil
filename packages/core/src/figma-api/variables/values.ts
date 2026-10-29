import type {
  SceneGraph,
  Variable,
  VariableLiteral,
  VariableType,
  VariableValue
} from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { variableValueReferences } from '@open-pencil/scene-graph/variables'

/** A reference to a variable, as Figma's plugin API writes one. */
export interface FigmaVariableAlias {
  type: 'VARIABLE_ALIAS'
  id: string
}

/** A colour from a colour variable and an opacity percentage, either of them a reference. */
export type FigmaComposedColor =
  | { color: Color | Omit<Color, 'a'>; opacity: FigmaVariableAlias }
  | { color: FigmaVariableAlias; opacity: number | FigmaVariableAlias }

/** A mode's value as Figma's plugin API reads and writes it. */
export type FigmaVariableValue =
  | boolean
  | string
  | number
  | Color
  | Omit<Color, 'a'>
  | FigmaVariableAlias
  | FigmaComposedColor

export function variableAlias(id: string): FigmaVariableAlias {
  return { type: 'VARIABLE_ALIAS', id }
}

/** The values `figma.variables.createVariable` starts every mode with, as Figma does. */
export const FIGMA_DEFAULT_VALUES: Record<VariableType, VariableLiteral> = {
  FLOAT: 0,
  STRING: 'String value',
  BOOLEAN: false,
  COLOR: { r: 1, g: 1, b: 1, a: 1 }
}

function isAlias(value: unknown): value is FigmaVariableAlias {
  if (typeof value !== 'object' || value === null) return false
  return (
    Reflect.get(value, 'type') === 'VARIABLE_ALIAS' && typeof Reflect.get(value, 'id') === 'string'
  )
}

/** A colour as Figma's plugin API takes it, RGB with an optional alpha. */
type FigmaColorInput = Omit<Color, 'a'> & Partial<Pick<Color, 'a'>>

function isColor(value: unknown): value is FigmaColorInput {
  if (typeof value !== 'object' || value === null) return false
  const channels = ['r', 'g', 'b'].map((key) => Reflect.get(value, key))
  const alpha: unknown = Reflect.get(value, 'a')
  return (
    channels.every((channel) => typeof channel === 'number') &&
    (alpha === undefined || typeof alpha === 'number')
  )
}

function storedColor(color: FigmaColorInput): Color {
  return { r: color.r, g: color.g, b: color.b, a: color.a ?? 1 }
}

function literal(value: VariableLiteral): FigmaVariableValue {
  return typeof value === 'object' ? { ...value } : value
}

/**
 * A mode's value as Figma's plugin API reads it. A colour expression reads as Figma's composed
 * colour; a formula reads as what it resolves to in that mode.
 */
export function figmaVariableValue(
  graph: SceneGraph,
  variable: Variable,
  modeId: string
): FigmaVariableValue {
  const value = variable.valuesByMode[modeId]
  if (typeof value !== 'object') return value
  if ('aliasId' in value) return variableAlias(value.aliasId)
  if ('expression' in value) {
    if (value.expression === 'COMPOSE_COLOR') {
      const ref = (part: Color | number | { aliasId: string }) =>
        typeof part === 'object' && 'aliasId' in part ? variableAlias(part.aliasId) : literal(part)
      return { color: ref(value.color), opacity: ref(value.opacity) } as FigmaComposedColor
    }
    const resolved = graph.resolveVariable(variable.id, modeId)
    return resolved === undefined ? FIGMA_DEFAULT_VALUES[variable.type] : literal(resolved)
  }
  return literal(value)
}

/** Whether a variable reads `id`, directly or through the variables it reads. */
function readsVariable(graph: SceneGraph, from: string, id: string): boolean {
  const seen = new Set<string>()
  const pending = [from]
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (next === id) return true
    if (seen.has(next)) continue
    seen.add(next)
    const variable = graph.variables.get(next)
    if (!variable) continue
    for (const value of Object.values(variable.valuesByMode)) {
      pending.push(...variableValueReferences(value))
    }
  }
  return false
}

/** A composed colour's part as the document stores it: a reference, a colour, or a number. */
function storedPart(input: unknown): Color | number | { aliasId: string } | undefined {
  if (isAlias(input)) return { aliasId: input.id }
  if (isColor(input)) return storedColor(input)
  return typeof input === 'number' ? input : undefined
}

/** A colour variable's value: a colour, or Figma's composed colour from its two parts. */
function storedColorValue(value: unknown): VariableValue | undefined {
  if (isColor(value)) return storedColor(value)
  if (typeof value !== 'object' || value === null) return undefined
  if (!('color' in value) || !('opacity' in value)) return undefined
  const color = storedPart(value.color)
  const opacity = storedPart(value.opacity)
  if (color === undefined || typeof color === 'number') return undefined
  if (opacity === undefined || (typeof opacity === 'object' && !('aliasId' in opacity)))
    return undefined
  return { expression: 'COMPOSE_COLOR', color, opacity }
}

/**
 * The value `setValueForMode` stores, or `null` for a reference Figma ignores: one that would make
 * the variable read itself. Throws Figma's messages for a value of the wrong type.
 */
export function storedVariableValue(
  graph: SceneGraph,
  variable: Variable,
  modeId: string,
  value: unknown
): VariableValue | null {
  const mismatch = () =>
    new TypeError(`in setValueForMode: Mismatched variable resolved type for mode ${modeId}`)
  if (!(modeId in variable.valuesByMode)) {
    throw new Error(`in setValueForMode: mode with id ${modeId} not defined for variable`)
  }
  if (isAlias(value)) {
    const target = graph.variables.get(value.id)
    if (!target) throw new Error('in setValueForMode: Variable not found')
    if (target.type !== variable.type) throw mismatch()
    return readsVariable(graph, target.id, variable.id) ? null : { aliasId: target.id }
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new TypeError('in setValueForMode: Property "newValue" failed validation')
  }
  if (variable.type === 'COLOR') {
    const color = storedColorValue(value)
    if (color === undefined) throw mismatch()
    return color
  }
  const expected = { FLOAT: 'number', STRING: 'string', BOOLEAN: 'boolean' }[variable.type]
  if (typeof value !== expected) throw mismatch()
  return value as VariableLiteral
}
