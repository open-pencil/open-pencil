import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import {
  createSceneGeometry,
  gradientHandleLayout,
  isGradientFill,
  type GradientHandleLayout,
  type RotationPreview,
  type ViewportTransform
} from '#core/geometry'

import type { GradientEdit } from './types'

/** The gradient paint being edited and the layer it belongs to, if it is still a gradient. */
export function editedGradient(graph: SceneGraph, edit: GradientEdit | null | undefined) {
  if (!edit) return null
  const node = graph.getNode(edit.nodeId)
  const paint = node?.[edit.paint][edit.index]
  if (!node || !paint || !isGradientFill(paint.type) || !paint.gradientTransform) return null
  return { node, paint, type: paint.type, transform: paint.gradientTransform }
}

/** Where the edited gradient's handles sit on screen. */
export function editedGradientLayout(
  graph: SceneGraph,
  edit: GradientEdit | null | undefined,
  viewport: ViewportTransform,
  preview?: RotationPreview | null
): GradientHandleLayout | null {
  const edited = editedGradient(graph, edit)
  if (!edited) return null
  const geometry = createSceneGeometry(graph, preview)
  const node: SceneNode = edited.node
  return gradientHandleLayout(
    edited.type,
    edited.transform,
    edited.paint.gradientStops ?? [],
    node.width,
    node.height,
    (local) => geometry.toScreen(node, local, viewport)
  )
}
