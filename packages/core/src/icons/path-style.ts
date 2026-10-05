import type { SceneNode, Stroke } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

const STROKE_CAP_MAP: Record<string, SceneNode['strokeCap']> = {
  butt: 'NONE',
  round: 'ROUND',
  square: 'SQUARE'
}

const STROKE_JOIN_MAP: Record<string, SceneNode['strokeJoin']> = {
  miter: 'MITER',
  round: 'ROUND',
  bevel: 'BEVEL'
}

export function createPathStroke(
  color: Color,
  weight: number,
  strokeCap: string,
  strokeJoin: string
): Stroke {
  return {
    type: 'SOLID',
    color,
    weight,
    opacity: 1,
    visible: true,
    align: 'CENTER',
    cap: STROKE_CAP_MAP[strokeCap] ?? 'NONE',
    join: STROKE_JOIN_MAP[strokeJoin] ?? 'MITER'
  }
}

/**
 * Node-level cap and join for an SVG path stroke. `.fig` files store these on the node, not on the
 * stroke paint, so a vector that sets only `Stroke.cap`/`Stroke.join` loses them when reopened.
 */
export function pathStrokeLineStyle(stroke: Stroke): Pick<SceneNode, 'strokeCap' | 'strokeJoin'> {
  return { strokeCap: stroke.cap ?? 'NONE', strokeJoin: stroke.join ?? 'MITER' }
}
