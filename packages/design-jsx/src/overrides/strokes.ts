import { designJSXProp } from '#design-jsx/definitions'
import { STROKE_ALIGN, STROKE_CAP, STROKE_JOIN } from '#design-jsx/enums'
import type { LayerProps } from '#design-jsx/schema'
import { omit } from 'es-toolkit'

import type { ColorProfile, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

/** One entry of the `strokes` prop; enums are lowercase, as `blendMode` is. */
export interface StrokeValue {
  color: string | Color
  /** Defaults to the colour's alpha. */
  opacity?: number
  weight?: number
  align?: string
  dash?: number[]
  cap?: string
  join?: string
  visible?: boolean
}

function isColor(value: unknown): value is Color {
  return value !== null && typeof value === 'object' && 'r' in value && 'a' in value
}

export function isStrokeValue(value: unknown): value is StrokeValue {
  if (value === null || typeof value !== 'object' || !('color' in value)) return false
  return typeof value.color === 'string' || isColor(value.color)
}

interface ShaderStrokeValue extends StrokeValue {
  type: string
  dashPattern?: unknown
}

function isShaderStroke(value: StrokeValue): value is ShaderStrokeValue {
  return 'type' in value && typeof value.type === 'string' && value.type.toUpperCase() === 'CUSTOM'
}

function dashValue(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined
  const dash = value.filter((item): item is number => typeof item === 'number')
  return dash.length > 0 ? dash : undefined
}

function toStroke(value: StrokeValue, profile: ColorProfile): Stroke {
  const color = typeof value.color === 'string' ? parseColor(value.color, profile) : value.color
  const stroke: Stroke = {
    type: 'SOLID',
    color,
    opacity: typeof value.opacity === 'number' ? value.opacity : color.a,
    visible: value.visible ?? true,
    weight: value.weight ?? 1,
    align: STROKE_ALIGN.parse(value.align) ?? 'INSIDE'
  }
  const dash = dashValue(value.dash)
  if (dash) stroke.dashPattern = dash
  const cap = STROKE_CAP.parse(value.cap)
  if (cap) stroke.cap = cap
  const join = STROKE_JOIN.parse(value.join)
  if (join) stroke.join = join
  return stroke
}

const READ_STROKE_KEYS = [
  'color',
  'opacity',
  'weight',
  'align',
  'dash',
  'dashPattern',
  'cap',
  'join',
  'visible'
] as const satisfies readonly (keyof ShaderStrokeValue)[]

function toShaderStroke(
  value: ShaderStrokeValue,
  dash: number[] | undefined,
  profile: ColorProfile
): Stroke {
  const lines = toStroke(
    { ...value, dash: value.dash ?? dashValue(value.dashPattern) ?? dash },
    profile
  )
  return { ...structuredClone(omit(value, READ_STROKE_KEYS)), ...lines, type: 'CUSTOM' }
}

/** `strokeWeights` names each side; a side it leaves out has no stroke. */
interface StrokeWeights {
  top?: unknown
  right?: unknown
  bottom?: unknown
  left?: unknown
}

function isStrokeWeights(value: unknown): value is StrokeWeights {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function sideWeight(value: unknown): number {
  return typeof value === 'number' ? value : 0
}

function applyStrokeWeights(value: unknown, o: Partial<SceneNode>): void {
  if (!isStrokeWeights(value)) return
  o.independentStrokeWeights = true
  o.borderTopWeight = sideWeight(value.top)
  o.borderRightWeight = sideWeight(value.right)
  o.borderBottomWeight = sideWeight(value.bottom)
  o.borderLeftWeight = sideWeight(value.left)
}

/** `strokes` takes structured strokes; `stroke` and its sibling props describe a single one. */
export function applyStrokeOverrides(
  props: LayerProps,
  o: Partial<SceneNode>,
  profile: ColorProfile
): void {
  applyStrokeWeights(props.strokeWeights, o)
  // Node-level cap and join, which strokes without their own use.
  const nodeCap = STROKE_CAP.parse(props.strokeCap)
  if (nodeCap) o.strokeCap = nodeCap
  const nodeJoin = STROKE_JOIN.parse(props.strokeJoin)
  if (nodeJoin) o.strokeJoin = nodeJoin
  // The node's dash, which strokes without their own dash take, as strokes take its cap and join.
  const nodeDash = dashValue(props.dashPattern)
  if (nodeDash) o.dashPattern = nodeDash
  const strokes = strokeValues(props).map((value) =>
    isShaderStroke(value)
      ? toShaderStroke(value, nodeDash, profile)
      : toStroke({ ...value, dash: value.dash ?? nodeDash }, profile)
  )
  if (strokes.length > 0) o.strokes = strokes
}

/** The strokes `strokes` lists, or the one `stroke` and its sibling props describe. */
function strokeValues(props: LayerProps): StrokeValue[] {
  if (Array.isArray(props.strokes)) return props.strokes.filter(isStrokeValue)
  const color = designJSXProp(props, 'stroke')
  if (typeof color !== 'string' && !isColor(color)) return []
  return [
    {
      color,
      weight: props.strokeWidth ?? props.borderWidth,
      align: props.strokeAlign as string | undefined,
      dash: props.strokeDash as number[] | undefined
    }
  ]
}
