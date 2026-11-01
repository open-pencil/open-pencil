import type { Canvas } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { FLASH_PADDING, FLASH_RADIUS, FLASH_STROKE_WIDTH } from '#core/constants'
import { type RotationPreview } from '#core/geometry'

import { inNodeSpace, withScreenStroke } from './overlays/outline'
import type { SkiaRenderer } from './renderer'

/**
 * Outlines the layer `nodeId` with a rounded stroke sized in screen pixels, placed through its
 * own and its ancestors' transforms, so a layer inside a rotated or flipped frame is outlined
 * where it is drawn.
 */
export function drawNodeHighlightRect(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  nodeId: string,
  color: { r: number; g: number; b: number },
  opacity: number,
  extraPad = 0,
  preview?: RotationPreview | null
): boolean {
  const node = graph.getNode(nodeId)
  if (!node) return false
  const pad = (FLASH_PADDING + extraPad) / r.zoom
  const radius = FLASH_RADIUS / r.zoom
  inNodeSpace(r, canvas, r.sceneGeometry(graph, preview), node, () =>
    withScreenStroke(
      r,
      { color: r.ck.Color4f(color.r, color.g, color.b, opacity), width: FLASH_STROKE_WIDTH },
      (paint) =>
        canvas.drawRRect(
          r.ck.RRectXY(
            r.ck.LTRBRect(-pad, -pad, node.width + pad, node.height + pad),
            radius,
            radius
          ),
          paint
        )
    )
  )
  return true
}
