import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getNodeLocalMatrix, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import {
  effectOverflow,
  geometryBlobBounds,
  strokeOverflow,
  textDecorationOverflow,
  unionVisualBounds,
  type VisualBounds
} from '@open-pencil/scene-graph/geometry'
import Matrix, { type Mat3 } from '@open-pencil/scene-graph/matrix'
import { textLinesOverflow } from '@open-pencil/scene-graph/text'

import { projectedNode, type RotationPreview } from '#core/geometry'

/** The axis-aligned box around `bounds` once `matrix` maps it. */
export function mapVisualBounds(matrix: Mat3, bounds: VisualBounds): VisualBounds {
  const points = Matrix.mapPoints(matrix, [
    bounds.minX,
    bounds.minY,
    bounds.maxX,
    bounds.minY,
    bounds.maxX,
    bounds.maxY,
    bounds.minX,
    bounds.maxY
  ])
  const xs = [points[0], points[2], points[4], points[6]]
  const ys = [points[1], points[3], points[5], points[7]]
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys)
  }
}

export function worldNodeVisualBounds(graph: SceneGraph, node: SceneNode): VisualBounds {
  const stroke = strokeOverflow(node.strokes, node.strokeCap, node.vectorNetwork, node)
  const effects = effectOverflow(node.effects)
  return mapVisualBounds(getWorldMatrix(node, graph), {
    minX: -stroke - effects.left,
    minY: -stroke - effects.top,
    maxX: node.width + stroke + effects.right,
    maxY: node.height + textLinesOverflow(node) + stroke + effects.bottom
  })
}

/**
 * What a node draws itself, in its own axes before position, rotation, and flips: the box grown
 * by strokes and effects, its path geometry, and text lines and decoration. Children are not
 * included.
 */
function localVisualBounds(node: SceneNode): VisualBounds {
  const stroke = strokeOverflow(node.strokes, node.strokeCap, node.vectorNetwork, node)
  const effects = effectOverflow(node.effects)
  const box: VisualBounds = {
    minX: -stroke - effects.left,
    minY: -stroke - effects.top,
    maxX: node.width + stroke + effects.right,
    maxY:
      node.height + textLinesOverflow(node) + stroke + effects.bottom + textDecorationOverflow(node)
  }
  const hasNonInsideStroke = node.strokes.some(
    (stroke) => stroke.visible && stroke.align !== 'INSIDE'
  )
  const geometry = geometryBlobBounds([
    ...node.fillGeometry,
    ...(hasNonInsideStroke ? node.strokeGeometry : [])
  ])
  if (!geometry) return box
  return {
    minX: Math.min(box.minX, geometry.x),
    minY: Math.min(box.minY, geometry.y),
    maxX: Math.max(box.maxX, geometry.x + geometry.width),
    maxY: Math.max(box.maxY, geometry.y + geometry.height)
  }
}

function clipsChildren(node: SceneNode): boolean {
  return (
    node.clipsContent &&
    (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE')
  )
}

/**
 * What a node and its visible descendants draw, in the frame `toFrame` maps the node's own axes
 * into. One pass down the subtree composes each child's local matrix, so no node walks its
 * ancestors. A container that clips its content ends the walk: its children draw inside its box,
 * which its own bounds already hold.
 */
export function subtreeVisualBounds(
  graph: SceneGraph,
  node: SceneNode,
  toFrame: Mat3,
  preview?: RotationPreview | null
): VisualBounds {
  let bounds = mapVisualBounds(toFrame, localVisualBounds(node))
  const pending = [{ node, matrix: toFrame }]
  for (let entry = pending.pop(); entry; entry = pending.pop()) {
    if (clipsChildren(entry.node)) continue
    for (const childId of entry.node.childIds) {
      const child = graph.getNode(childId)
      if (!child?.visible) continue
      const local = getNodeLocalMatrix(projectedNode(child, preview))
      const matrix = Matrix.multiply(entry.matrix, local)
      bounds =
        unionVisualBounds(bounds, mapVisualBounds(matrix, localVisualBounds(child))) ?? bounds
      pending.push({ node: child, matrix })
    }
  }
  return bounds
}
