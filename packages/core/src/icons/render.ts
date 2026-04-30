import { parseColor } from '#core/color'

import type { SceneGraph, SceneNode, Stroke } from '#core/scene-graph'
import type { Color } from '#core/types'
import type { IconData } from './types'

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

export function createIconFromPaths(
  graph: SceneGraph,
  icon: IconData,
  name: string,
  size: number,
  color: Color,
  parentId: string,
  overrides?: Partial<SceneNode>
): SceneNode {
  const frame = graph.createNode('FRAME', parentId, {
    name: `Icon / ${name}`,
    width: size,
    height: size,
    fills: [],
    ...overrides
  })

  for (const path of icon.paths) {
    const vector = graph.createNode('VECTOR', frame.id, {
      name: 'path',
      width: size,
      height: size,
      vectorNetwork: path.vectorNetwork
    })
    vector.x = 0
    vector.y = 0

    if (path.fill) {
      const fillColor = path.fill === 'currentColor' ? color : parseColor(path.fill)
      graph.updateNode(vector.id, {
        fills: [{ type: 'SOLID', color: fillColor, opacity: 1, visible: true }]
      })
    } else {
      graph.updateNode(vector.id, { fills: [] })
    }

    if (path.stroke) {
      const strokeColor = path.stroke === 'currentColor' ? color : parseColor(path.stroke)
      const stroke: Stroke = {
        color: strokeColor,
        weight: path.strokeWidth,
        opacity: 1,
        visible: true,
        align: 'CENTER',
        cap: STROKE_CAP_MAP[path.strokeCap] ?? 'NONE',
        join: STROKE_JOIN_MAP[path.strokeJoin] ?? 'MITER'
      }
      graph.updateNode(vector.id, { strokes: [stroke] })
    }
  }

  return frame
}
