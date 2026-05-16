import type { SceneNode, Stroke } from '#core/scene-graph'
import type { Color } from '#core/types'

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
    color,
    weight,
    opacity: 1,
    visible: true,
    align: 'CENTER',
    cap: STROKE_CAP_MAP[strokeCap] ?? 'NONE',
    join: STROKE_JOIN_MAP[strokeJoin] ?? 'MITER'
  }
}
