import type { VariableType } from '../types'

export const NUMERIC_FIELDS = new Set([
  'opacity',
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'x',
  'y',
  'rotation',
  'cornerRadius',
  'topLeftRadius',
  'topRightRadius',
  'bottomLeftRadius',
  'bottomRightRadius',
  'strokeWeight',
  'borderTopWeight',
  'borderBottomWeight',
  'borderLeftWeight',
  'borderRightWeight',
  'fontSize',
  'letterSpacing',
  'lineHeight',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'paddingBottom',
  'itemSpacing',
  'counterAxisSpacing',
  'gridRowGap',
  'gridColumnGap'
])

export function isNumericVariableBindingField(field: string): boolean {
  return NUMERIC_FIELDS.has(field)
}

/** Text content and font family are the string-valued bindings a node accepts. */
export const STRING_BINDING_FIELDS: ReadonlySet<string> = new Set(['text', 'fontFamily'])

/**
 * The variable types text content binds to: text, or a number shown as text, as Figma's layer
 * panel offers. Figma's plugin API takes text alone; font family stays text-only.
 */
export const TEXT_CONTENT_VARIABLE_TYPES = [
  'STRING',
  'FLOAT'
] as const satisfies readonly VariableType[]

/** Visibility is the only boolean-valued binding a node accepts. */
export const BOOLEAN_BINDING_FIELDS: ReadonlySet<string> = new Set(['visible'])

/**
 * The variable types visibility binds to: a boolean, or text that shows the layer unless it reads
 * as false, as Figma's layer panel offers. Figma's plugin API takes booleans alone.
 */
export const VISIBILITY_VARIABLE_TYPES = [
  'BOOLEAN',
  'STRING'
] as const satisfies readonly VariableType[]

/** The paint lists whose colours bind to variables, one binding field per paint. */
export type PaintBindingList = 'fills' | 'strokes'

const PAINT_BINDING_FIELD = /^(fills|strokes)\/(\d+)\/color$/

/**
 * The paint a binding field names the colour of, such as the second fill for `fills/1/color`, or
 * null for a field that binds anything else.
 */
export function paintBindingTarget(
  field: string
): { list: PaintBindingList; index: number } | null {
  if (!field.endsWith('/color')) return null
  const match = PAINT_BINDING_FIELD.exec(field)
  if (!match) return null
  return { list: match[1] === 'fills' ? 'fills' : 'strokes', index: Number(match[2]) }
}
