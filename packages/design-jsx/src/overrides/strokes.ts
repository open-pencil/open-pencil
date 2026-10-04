import { designJSXProp } from '#design-jsx/schema'

import type { SceneNode, Stroke, StrokeCap, StrokeJoin } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

const ALIGN_VALUES: Record<string, Stroke['align']> = {
  inside: 'INSIDE',
  center: 'CENTER',
  outside: 'OUTSIDE'
}

const CAP_VALUES: Record<string, StrokeCap> = {
  none: 'NONE',
  round: 'ROUND',
  square: 'SQUARE',
  arrow_lines: 'ARROW_LINES',
  arrow_equilateral: 'ARROW_EQUILATERAL'
}

const JOIN_VALUES: Record<string, StrokeJoin> = {
  miter: 'MITER',
  bevel: 'BEVEL',
  round: 'ROUND'
}

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

function isStrokeValue(value: unknown): value is StrokeValue {
  if (value === null || typeof value !== 'object' || !('color' in value)) return false
  return typeof value.color === 'string' || isColor(value.color)
}

function enumValue<T>(values: Record<string, T>, value: unknown): T | undefined {
  return typeof value === 'string' ? values[value.toLowerCase()] : undefined
}

function dashValue(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined
  const dash = value.filter((item): item is number => typeof item === 'number')
  return dash.length > 0 ? dash : undefined
}

function toStroke(value: StrokeValue): Stroke {
  const color = typeof value.color === 'string' ? parseColor(value.color) : value.color
  const stroke: Stroke = {
    type: 'SOLID',
    color,
    opacity: typeof value.opacity === 'number' ? value.opacity : color.a,
    visible: value.visible ?? true,
    weight: value.weight ?? 1,
    align: enumValue(ALIGN_VALUES, value.align) ?? 'INSIDE'
  }
  const dash = dashValue(value.dash)
  if (dash) stroke.dashPattern = dash
  const cap = enumValue(CAP_VALUES, value.cap)
  if (cap) stroke.cap = cap
  const join = enumValue(JOIN_VALUES, value.join)
  if (join) stroke.join = join
  return stroke
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
export function applyStrokeOverrides(props: Record<string, unknown>, o: Partial<SceneNode>): void {
  applyStrokeWeights(props.strokeWeights, o)
  // Node-level cap and join, which strokes without their own use.
  const nodeCap = enumValue(CAP_VALUES, props.strokeCap)
  if (nodeCap) o.strokeCap = nodeCap
  const nodeJoin = enumValue(JOIN_VALUES, props.strokeJoin)
  if (nodeJoin) o.strokeJoin = nodeJoin
  // The node's own dash pattern, separate from the stroke-local dash `strokeDash` sets.
  const nodeDash = dashValue(props.dashPattern)
  if (nodeDash) o.dashPattern = nodeDash

  if (Array.isArray(props.strokes)) {
    const strokes = props.strokes.filter(isStrokeValue).map(toStroke)
    if (strokes.length > 0) o.strokes = strokes
    return
  }

  const color = designJSXProp(props, 'stroke')
  if (typeof color !== 'string' && !isColor(color)) return
  o.strokes = [
    toStroke({
      color,
      weight:
        (props.strokeWidth as number | undefined) ?? (props.borderWidth as number | undefined),
      align: props.strokeAlign as string | undefined,
      dash: props.strokeDash as number[] | undefined
    })
  ]
}
