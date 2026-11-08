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

/**
 * A frame holding a group of two rectangles, the first pinned Right & Bottom and the second with
 * `second` on both axes, as in the Figma probe for #1835.
 */
export function createConstrainedGroupScene(
  graph: SceneGraph,
  pageId: string,
  second: ConstraintType
) {
  const frame = graph.createNode('FRAME', pageId, {
    name: 'Frame',
    x: 160,
    y: 140,
    width: 360,
    height: 240,
    fills: [solid(1, 1, 1)]
  })
  const group = graph.createNode('GROUP', frame.id, {
    name: 'Group',
    x: 80,
    y: 60,
    width: 170,
    height: 110
  })
  const first = graph.createNode('RECTANGLE', group.id, {
    name: 'First',
    width: 60,
    height: 40,
    horizontalConstraint: 'MAX',
    verticalConstraint: 'MAX',
    fills: [solid(0.42, 0.78, 0.58)]
  })
  graph.createNode('RECTANGLE', group.id, {
    name: 'Second',
    x: 120,
    y: 70,
    width: 50,
    height: 40,
    horizontalConstraint: second,
    verticalConstraint: second,
    fills: [solid(0.36, 0.52, 0.92)]
  })
  return { frame: frame.id, group: group.id, first: first.id }
}
