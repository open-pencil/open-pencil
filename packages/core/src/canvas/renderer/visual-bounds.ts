import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import { unionVisualBounds, type VisualBounds } from '@open-pencil/scene-graph/geometry'
import type { Mat3 } from '@open-pencil/scene-graph/matrix'

import type { RotationPreview } from '#core/geometry'
import {
  localRenderBounds,
  mapVisualBounds,
  subtreeRenderBounds
} from '#core/geometry/render-bounds'

/** Where a node that draws nothing stands: its origin, as a box of no size. */
function origin(matrix: Mat3): VisualBounds {
  return mapVisualBounds(matrix, { minX: 0, minY: 0, maxX: 0, maxY: 0 })
}

/** What a node draws itself on the page, as far as the canvas draws its effects. */
export function worldNodeVisualBounds(graph: SceneGraph, node: SceneNode): VisualBounds {
  const matrix = getWorldMatrix(node, graph)
  const local = localRenderBounds(node, 'drawn')
  return local ? mapVisualBounds(matrix, local) : origin(matrix)
}

/**
 * What a node and its visible descendants draw, in the frame `toFrame` maps the node's own axes
 * into, as far as the canvas draws their effects (`subtreeRenderBounds`).
 */
export function subtreeVisualBounds(
  graph: SceneGraph,
  node: SceneNode,
  toFrame: Mat3,
  preview?: RotationPreview | null
): VisualBounds {
  return subtreeRenderBounds(graph, node, toFrame, { reach: 'drawn', preview }) ?? origin(toFrame)
}

/**
 * What the layers and their visible descendants draw, in page coordinates, as far as the canvas
 * draws their effects; null when none is visible.
 */
export function computeContentBounds(
  graph: SceneGraph,
  nodeIds: readonly string[]
): VisualBounds | null {
  let bounds: VisualBounds | null = null
  for (const nodeId of nodeIds) {
    const node = graph.getNode(nodeId)
    if (!node?.visible) continue
    bounds = unionVisualBounds(
      bounds,
      subtreeVisualBounds(graph, node, getWorldMatrix(node, graph))
    )
  }
  return bounds
}
