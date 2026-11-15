import type { Fill, GradientTransform } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

/** A visible solid paint of `color` at `opacity`, for scenes the canvas specs build. */
export function paint(color: Color, opacity = 1): Fill {
  return { type: 'SOLID', color, opacity, visible: true }
}

/** A visible solid paint of an opaque colour at `opacity`. */
export function solid(r: number, g: number, b: number, opacity = 1): Fill {
  return paint({ r, g, b, a: 1 }, opacity)
}

/** Figma's linear gradient transform from the left edge's middle to the right's. */
const LEFT_TO_RIGHT: GradientTransform = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }

/** A visible linear gradient through `colors`, spaced evenly, from left to right unless turned. */
export function linearGradient(colors: Color[], transform = LEFT_TO_RIGHT): Fill {
  return {
    type: 'GRADIENT_LINEAR',
    color: { r: 0, g: 0, b: 0, a: 1 },
    visible: true,
    opacity: 1,
    gradientStops: colors.map((color, index) => ({
      color,
      position: index / (colors.length - 1)
    })),
    gradientTransform: transform
  }
}
