import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import {
  blurSigma,
  unionVisualBounds,
  type VisualBounds,
  widestBlurRadius
} from '@open-pencil/scene-graph/geometry'
import type { Mat3 } from '@open-pencil/scene-graph/matrix'

import { glassSampleRadius } from '#core/canvas/glass/shader'
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

/**
 * How far past what a node draws its effects read the canvas behind it, in page units: glass
 * refraction and background blur sample the backdrop around each point they draw. 0 for none.
 */
function nodeBackdropReach(graph: SceneGraph, node: SceneNode): number {
  let reach = 0
  for (const effect of node.effects) {
    if (!effect.visible) continue
    if (effect.type === 'GLASS') reach = Math.max(reach, glassSampleRadius(node, effect))
    if (effect.type === 'BACKGROUND_BLUR') {
      reach = Math.max(reach, 3 * blurSigma(widestBlurRadius(effect)) + 1)
    }
  }
  if (reach === 0) return 0
  const matrix = getWorldMatrix(node, graph)
  return reach * Math.max(Math.hypot(matrix[0], matrix[3]), Math.hypot(matrix[1], matrix[4]))
}

/** The farthest backdrop reach of a node, or with `subtree` of it and its visible descendants. */
export function backdropReach(graph: SceneGraph, node: SceneNode, subtree: boolean): number {
  if (!subtree) return nodeBackdropReach(graph, node)
  let reach = 0
  const stack = [node]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current?.visible) continue
    reach = Math.max(reach, nodeBackdropReach(graph, current))
    for (const childId of current.childIds) {
      const child = graph.getNode(childId)
      if (child) stack.push(child)
    }
  }
  return reach
}
