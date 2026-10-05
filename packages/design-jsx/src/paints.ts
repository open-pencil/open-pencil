import * as v from 'valibot'

import type {
  BlendMode,
  Fill,
  FillType,
  GradientStop,
  GradientTransform
} from '@open-pencil/scene-graph'
import { colorToFill, parseColor } from '@open-pencil/scene-graph/color'
import { TRANSPARENT } from '@open-pencil/scene-graph/constants'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { parseScriptInput } from './validation'

export type PaintColor = string | Color
export type PaintStop = readonly [PaintColor, number] | { color: PaintColor; position: number }

export interface SolidPaintOptions {
  opacity?: number
  visible?: boolean
  blendMode?: BlendMode
}

export interface GradientPaintOptions extends SolidPaintOptions {
  transform?: GradientTransform
}

const DEFAULT_GRADIENT_TRANSFORM: GradientTransform = {
  m00: 1,
  m01: 0,
  m02: 0,
  m10: 0,
  m11: 1,
  m12: 0
}

const colorSchema = v.union([
  v.string(),
  v.object({ r: v.number(), g: v.number(), b: v.number(), a: v.number() })
])
const stopsSchema = v.array(
  v.union(
    [v.tuple([colorSchema, v.number()]), v.object({ color: colorSchema, position: v.number() })],
    (issue) => `Expected [color, position] or { color, position } but received ${issue.received}`
  )
)

const GRADIENT_HELPERS = {
  GRADIENT_LINEAR: 'linearGradient',
  GRADIENT_RADIAL: 'radialGradient',
  GRADIENT_ANGULAR: 'angularGradient',
  GRADIENT_DIAMOND: 'diamondGradient'
} as const

type GradientType = keyof typeof GRADIENT_HELPERS

/**
 * Scripts call the helpers with whatever they guess, so a wrong call says what it expects
 * and what was wrong, as Valibot describes it.
 */
function parseStops(type: GradientType, stops: unknown): PaintStop[] {
  return parseScriptInput(
    `${GRADIENT_HELPERS[type]}() expects an array of stops, such as [['#3b82f6', 0], ['#8b5cf6', 1]]`,
    stopsSchema,
    stops
  )
}

function toColor(color: PaintColor): Color {
  return typeof color === 'string' ? parseColor(color) : color
}

function toStop(stop: PaintStop): GradientStop {
  if ('color' in stop) {
    return { color: toColor(stop.color), position: stop.position }
  }
  return { color: toColor(stop[0]), position: stop[1] }
}

export function solid(color: PaintColor, options: SolidPaintOptions = {}): Fill {
  const fill = colorToFill(color)
  return {
    ...fill,
    opacity: options.opacity ?? fill.opacity,
    visible: options.visible ?? true,
    blendMode: options.blendMode
  }
}

export function gradient(
  type: Extract<FillType, GradientType>,
  stops: PaintStop[],
  options: GradientPaintOptions = {}
): Fill {
  return {
    type,
    color: { ...TRANSPARENT },
    opacity: options.opacity ?? 1,
    visible: options.visible ?? true,
    blendMode: options.blendMode,
    gradientStops: parseStops(type, stops).map(toStop),
    gradientTransform: options.transform ?? DEFAULT_GRADIENT_TRANSFORM
  }
}

export function linearGradient(stops: PaintStop[], options?: GradientPaintOptions): Fill {
  return gradient('GRADIENT_LINEAR', stops, options)
}

export function radialGradient(stops: PaintStop[], options?: GradientPaintOptions): Fill {
  return gradient('GRADIENT_RADIAL', stops, options)
}

export function angularGradient(stops: PaintStop[], options?: GradientPaintOptions): Fill {
  return gradient('GRADIENT_ANGULAR', stops, options)
}

export function diamondGradient(stops: PaintStop[], options?: GradientPaintOptions): Fill {
  return gradient('GRADIENT_DIAMOND', stops, options)
}
