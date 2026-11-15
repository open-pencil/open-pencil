import { once } from 'es-toolkit'

import type { ImageFilter } from '@open-pencil/canvaskit'
import type { Effect, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { VisualBounds } from '@open-pencil/scene-graph/geometry'
import Matrix from '@open-pencil/scene-graph/matrix'

import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer'
import { subtreeVisualBounds } from '#core/canvas/renderer/visual-bounds'
import { nodeOrientationMatrix } from '#core/geometry'

/**
 * A layer blur's filter. It runs before the layer's rotation and flips are applied, so a
 * progressive blur's points are mapped through them from the layer's own coordinates, and what
 * the subtree draws is measured through them too.
 */
export function layerBlurFilter(
  r: SkiaRenderer,
  node: SceneNode,
  blur: Effect,
  overlays: RenderOverlays,
  content: () => VisualBounds
): ImageFilter | null {
  if (!blur.progressive) return r.getCachedLayerBlur(blur, node.width, node.height, null)
  const matrix = nodeOrientationMatrix(node, overlays.rotationPreview)
  return r.getCachedLayerBlur(blur, node.width, node.height, content(), (point) =>
    Matrix.mapPoint(matrix, point)
  )
}

/**
 * What a blurred layer's subtree draws, measured through the layer's rotation and flips, as its
 * blur's filter and layer both run before them; measured once, and only if either needs it.
 */
export function blurredContent(
  graph: SceneGraph,
  node: SceneNode,
  overlays: RenderOverlays
): () => VisualBounds {
  const preview = overlays.rotationPreview
  return once(() => subtreeVisualBounds(graph, node, nodeOrientationMatrix(node, preview), preview))
}
