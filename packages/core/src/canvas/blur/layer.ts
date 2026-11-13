import { once } from 'es-toolkit'

import type { ImageFilter } from '@open-pencil/canvaskit'
import type { Effect, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { VisualBounds } from '@open-pencil/scene-graph/geometry'
import Matrix, { type Mat3 } from '@open-pencil/scene-graph/matrix'

import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer'
import { subtreeVisualBounds } from '#core/canvas/renderer/visual-bounds'
import { nodeOrientationMatrix } from '#core/geometry'
import { mapVisualBounds } from '#core/geometry/render-bounds'

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

/**
 * The layer a layer blur draws into: what the subtree draws, and two blur radii around it, as far
 * as the blur spreads. It opens before the node's rotation and flips, so the subtree is measured
 * through them; its own box would cut off what a rotation moves above or left of it.
 */
export function blurLayerBounds(
  r: SkiaRenderer,
  world: Mat3,
  radius: number,
  content: () => VisualBounds
): Float32Array {
  const viewportBounds = viewportLayerBounds(r, world, radius * 2)
  if (viewportBounds) return viewportBounds
  // Visual bounds already reach one blur radius past what the subtree draws.
  const bounds = content()
  return r.ck.LTRBRect(
    bounds.minX - radius,
    bounds.minY - radius,
    bounds.maxX + radius,
    bounds.maxY + radius
  )
}

/**
 * The part of the viewport a layer opened at `world` must hold, padded by `padding`, while the
 * renderer bounds effect layers to the viewport; null when it does not.
 */
export function viewportLayerBounds(
  r: SkiaRenderer,
  world: Mat3,
  padding: number
): Float32Array | null {
  if (!r.boundEffectLayersToViewport) return null
  const inverse = Matrix.invert(world)
  if (!inverse) return null
  const viewport = r.worldViewport
  const bounds = mapVisualBounds(inverse, {
    minX: viewport.x,
    minY: viewport.y,
    maxX: viewport.x + viewport.w,
    maxY: viewport.y + viewport.h
  })
  return r.ck.LTRBRect(
    bounds.minX - padding,
    bounds.minY - padding,
    bounds.maxX + padding,
    bounds.maxY + padding
  )
}
