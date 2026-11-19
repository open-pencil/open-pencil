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
import {
  IDENTITY_GRADIENT_TRANSFORM,
  type GradientTransformRows
} from '@open-pencil/scene-graph/gradient'
import { paintTransformSchema } from '@open-pencil/scene-graph/paints'
import type { Color } from '@open-pencil/scene-graph/primitives'
import {
  createShaderPaint,
  shaderPresetSchema,
  type ShaderComponent,
  type ShaderPreset
} from '@open-pencil/scene-graph/shaders'

import { parseScriptInput } from '../schema'

export type PaintColor = string | Color
export type PaintStop = readonly [PaintColor, number] | { color: PaintColor; position: number }

export interface SolidPaintOptions {
  opacity?: number
  visible?: boolean
  blendMode?: BlendMode
}

export interface GradientPaintOptions extends SolidPaintOptions {
  /** Figma's `gradientTransform`, as its plugin API's rows or as the matrix fields. */
  transform?: GradientTransformRows | GradientTransform
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

function parseTransform(type: GradientType, transform: unknown): GradientTransform {
  return parseScriptInput(
    `${GRADIENT_HELPERS[type]}() expects a transform as Figma's [[a, b, c], [d, e, f]], such as [[0, 1, 0], [-1, 0, 1]], or { m00, m01, m02, m10, m11, m12 }`,
    paintTransformSchema,
    transform
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
    gradientTransform:
      options.transform === undefined
        ? { ...IDENTITY_GRADIENT_TRANSFORM }
        : parseTransform(type, options.transform)
  }
}

/** A paint that draws a shader, carrying its preset until the layer it fills stores it. */
export interface ShaderFill extends Fill {
  shader: ShaderPreset
}

/** Whether a paint value came from {@link shader}. */
export function isShaderFill(value: Fill): value is ShaderFill {
  return 'shader' in value
}

const shaderInputSchema = v.union(
  [
    shaderPresetSchema,
    v.pipe(
      v.array(v.unknown()),
      v.transform((components) => ({ components })),
      shaderPresetSchema
    )
  ],
  (issue) =>
    `Expected a preset { components: [...] } or an array of effects but received ${issue.received}`
)

/**
 * A paint that draws a shader from the `shaders` library: a preset as shaders.com exports it, or
 * just its effects, such as `shader([{ type: 'Aurora' }])`.
 */
export function shader(
  preset: ShaderPreset | ShaderComponent[],
  options: SolidPaintOptions = {}
): ShaderFill {
  const parsed = parseScriptInput(
    "shader() expects a preset such as { components: [{ type: 'Aurora' }] } or an array of effects",
    shaderInputSchema,
    preset
  )
  const { paint } = createShaderPaint(parsed)
  return {
    ...paint,
    opacity: options.opacity ?? 1,
    visible: options.visible ?? true,
    blendMode: options.blendMode,
    shader: parsed
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
