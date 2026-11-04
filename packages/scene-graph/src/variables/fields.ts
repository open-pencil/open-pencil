import type { Effect, VariableType } from '../types'

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

/** The effect fields that bind to variables, in the order Figma's messages list them. */
export const EFFECT_BINDING_PROPERTIES = [
  'color',
  'radius',
  'spread',
  'offsetX',
  'offsetY'
] as const

export type EffectBindingProperty = (typeof EFFECT_BINDING_PROPERTIES)[number]

const EFFECT_BINDING_FIELD = /^effects\/(\d+)\/(color|radius|spread|offsetX|offsetY)$/

const BLUR_BINDING_PROPERTIES = ['radius'] as const satisfies readonly EffectBindingProperty[]

/** The node binding field for one property of the effect at `index`, such as `effects/0/radius`. */
export function effectBindingField(index: number, property: EffectBindingProperty): string {
  return `effects/${index}/${property}`
}

/**
 * The effect and property a binding field names, such as the second effect's blur for
 * `effects/1/radius`, or null for a field that binds anything else.
 */
export function effectBindingTarget(
  field: string
): { index: number; property: EffectBindingProperty } | null {
  if (!field.startsWith('effects/')) return null
  const match = EFFECT_BINDING_FIELD.exec(field)
  if (!match) return null
  return { index: Number(match[1]), property: match[2] as EffectBindingProperty }
}

/** The properties of an effect that bind: every shadow property, and only a blur's radius. */
export function effectBindableProperties(type: Effect['type']): readonly EffectBindingProperty[] {
  return type === 'DROP_SHADOW' || type === 'INNER_SHADOW'
    ? EFFECT_BINDING_PROPERTIES
    : BLUR_BINDING_PROPERTIES
}

/** The variable type an effect property binds to: colour to COLOR, lengths to FLOAT. */
export function effectBindingVariableType(property: EffectBindingProperty): 'COLOR' | 'FLOAT' {
  return property === 'color' ? 'COLOR' : 'FLOAT'
}
