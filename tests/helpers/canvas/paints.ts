import type { Fill } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

/** A visible solid paint of `color` at `opacity`, for scenes the canvas specs build. */
export function paint(color: Color, opacity = 1): Fill {
  return { type: 'SOLID', color, opacity, visible: true }
}

/** A visible solid paint of an opaque colour at `opacity`. */
export function solid(r: number, g: number, b: number, opacity = 1): Fill {
  return paint({ r, g, b, a: 1 }, opacity)
}
