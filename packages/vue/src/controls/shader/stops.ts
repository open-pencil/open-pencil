import * as v from 'valibot'

import type { Fill } from '@open-pencil/scene-graph'
import { colorToHex8, parseColor } from '@open-pencil/scene-graph/color'
import { DEFAULT_GRADIENT_TRANSFORM } from '@open-pencil/scene-graph/gradient'

/** A color stop of a shader's gradient, as the `shaders` library takes it: sRGB hex and 0 to 1. */
export interface ShaderStop {
  color: string
  position: number
}

const stopsSchema = v.pipe(
  v.array(v.object({ color: v.string(), position: v.number() })),
  v.minLength(2)
)

/** A prop's value as color stops, or null when it holds none, as before any are set. */
export function shaderStops(value: unknown): ShaderStop[] | null {
  const parsed = v.safeParse(stopsSchema, value)
  return parsed.success ? parsed.output : null
}

/** The stops as a linear gradient fill, which the gradient editor edits. */
export function stopsFill(stops: readonly ShaderStop[]): Fill {
  const first = parseColor(stops[0]?.color ?? '#000000')
  return {
    type: 'GRADIENT_LINEAR',
    color: first,
    opacity: 1,
    visible: true,
    gradientStops: stops.map((stop) => ({
      color: parseColor(stop.color),
      position: stop.position
    })),
    gradientTransform: DEFAULT_GRADIENT_TRANSFORM
  }
}

/** The gradient fill's stops back as the shader's, in position order; opaque colors stay six-digit. */
export function fillStops(fill: Fill): ShaderStop[] {
  return (fill.gradientStops ?? [])
    .map((stop) => ({ color: colorToHex8(stop.color).toLowerCase(), position: stop.position }))
    .sort((a, b) => a.position - b.position)
}

/**
 * Stops to start from for an effect whose gradient comes from its own colors until stops are set:
 * the first two colors the effect has, from its start to its end.
 */
export function seedStops(colors: readonly string[]): ShaderStop[] {
  const [start = '#000000', end = '#ffffff'] = colors
  return [
    { color: start, position: 0 },
    { color: end, position: 1 }
  ]
}
