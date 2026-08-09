import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { parseColor } from '#core/color'
import { createPathStroke } from '#core/icons/path-style'

import type { IconData } from './types'

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

    // `fill="none"` is a non-empty string, so a truthiness check treats it as a
    // colour and parseColor() falls back to black — outline drawings came out
    // as solid black blobs.
    if (path.fill && path.fill !== 'none') {
      const fillColor = path.fill === 'currentColor' ? color : parseColor(path.fill)
      graph.updateNode(vector.id, {
        fills: [{ type: 'SOLID', color: fillColor, opacity: 1, visible: true }]
      })
    } else {
      graph.updateNode(vector.id, { fills: [] })
    }

    if (path.stroke && path.stroke !== 'none') {
      const strokeColor = path.stroke === 'currentColor' ? color : parseColor(path.stroke)
      graph.updateNode(vector.id, {
        strokes: [createPathStroke(strokeColor, path.strokeWidth, path.strokeCap, path.strokeJoin)]
      })
    }
  }

  return frame
}
