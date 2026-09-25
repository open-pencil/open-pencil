import { getWorldMatrix, TransformMatrix, type SceneGraph } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

/**
 * Box, in `parentId`'s own coordinates, that holds `nodeIds` — where a group or boolean
 * operation made from them sits. Corners are mapped through the parent's inverse world
 * matrix, so a rotated or flipped parent gets a box in its own axes.
 */
export function containerRectInParent(
  graph: SceneGraph,
  nodeIds: readonly string[],
  parentId: string
): Rect {
  const parent = graph.getNode(parentId)
  const parentWorld =
    !parent || parentId === graph.rootId
      ? TransformMatrix.identity()
      : getWorldMatrix(parent, graph)
  const toParent = TransformMatrix.invert(parentWorld) ?? TransformMatrix.identity()

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const id of nodeIds) {
    const node = graph.getNode(id)
    if (!node) throw new Error(`Node ${id} not found`)
    const matrix = TransformMatrix.multiply(toParent, getWorldMatrix(node, graph))
    const { width: w, height: h } = node
    const points = TransformMatrix.mapPoints(matrix, [0, 0, w, 0, w, h, 0, h])
    for (let i = 0; i < points.length; i += 2) {
      minX = Math.min(minX, points[i])
      minY = Math.min(minY, points[i + 1])
      maxX = Math.max(maxX, points[i])
      maxY = Math.max(maxY, points[i + 1])
    }
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
