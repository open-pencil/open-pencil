import type { ConstraintType, SceneGraph } from '@open-pencil/scene-graph'

import { solid } from '../paints'

/** A rectangle with the given constraints inside a frame turned by `rotation` degrees. */
export function createConstrainedLayerScene(
  graph: SceneGraph,
  pageId: string,
  horizontal: ConstraintType,
  vertical: ConstraintType,
  rotation: number
) {
  const frame = graph.createNode('FRAME', pageId, {
    name: 'Frame',
    x: 160,
    y: 140,
    width: 360,
    height: 240,
    rotation,
    fills: [solid(1, 1, 1)]
  })
  const rectangle = graph.createNode('RECTANGLE', frame.id, {
    name: 'Rectangle',
    x: 100,
    y: 60,
    width: 120,
    height: 80,
    horizontalConstraint: horizontal,
    verticalConstraint: vertical,
    fills: [solid(0.42, 0.78, 0.58)]
  })
  return { frame: frame.id, rectangle: rectangle.id }
}
