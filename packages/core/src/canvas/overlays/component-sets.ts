import type { Canvas } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { labelViewport } from '#core/canvas/labels/layout'
import type { SkiaRenderer } from '#core/canvas/renderer'
import { COMPONENT_SET_OUTLINE_RADIUS } from '#core/constants'
import { createSceneGeometry, type RotationPreview } from '#core/geometry'

/**
 * The dashed editing border of each component set without a stroke of its own. It is drawn
 * every frame at the live zoom, so it stays one pixel wide on screen; drawn into the scene, it
 * would scale with the cached pictures it was recorded in. A set with a stroke draws that
 * stroke in the scene instead.
 */
export function drawComponentSetBorders(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  preview?: RotationPreview | null
): void {
  const sets = r.labelCache
    .getComponentSets(graph, labelViewport(r.worldViewport, r.zoom), preview)
    .filter(({ node }) => !node.strokes.some((stroke) => stroke.visible))
  if (sets.length === 0) return

  const geometry = createSceneGeometry(graph, preview)
  const dash = r.ck.PathEffect.MakeDash(
    [r.COMPONENT_SET_DASH / r.zoom, r.COMPONENT_SET_DASH_GAP / r.zoom],
    0
  )
  r.auxStroke.setStrokeWidth(r.COMPONENT_SET_BORDER_WIDTH / r.zoom)
  r.auxStroke.setColor(r.compColor())
  r.auxStroke.setPathEffect(dash)
  try {
    for (const { node } of sets) {
      canvas.save()
      canvas.concat(geometry.screenMatrix(node, r))
      const rect = r.ck.LTRBRect(0, 0, node.width, node.height)
      canvas.drawRRect(
        r.ck.RRectXY(rect, COMPONENT_SET_OUTLINE_RADIUS, COMPONENT_SET_OUTLINE_RADIUS),
        r.auxStroke
      )
      canvas.restore()
    }
  } finally {
    r.auxStroke.setPathEffect(null)
    dash.delete()
  }
}
