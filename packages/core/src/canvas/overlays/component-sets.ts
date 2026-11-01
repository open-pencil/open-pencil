import type { Canvas } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { labelViewport } from '#core/canvas/labels/layout'
import type { SkiaRenderer } from '#core/canvas/renderer'
import {
  COMPONENT_SET_BORDER_WIDTH,
  COMPONENT_SET_DASH,
  COMPONENT_SET_DASH_GAP,
  COMPONENT_SET_OUTLINE_RADIUS
} from '#core/constants'
import { type RotationPreview } from '#core/geometry'

import { inNodeSpace, withScreenStroke } from './outline'

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

  const geometry = r.sceneGeometry(graph, preview)
  const stroke = {
    color: r.compColor(),
    width: COMPONENT_SET_BORDER_WIDTH,
    dash: [COMPONENT_SET_DASH, COMPONENT_SET_DASH_GAP] as const
  }
  withScreenStroke(r, stroke, (paint) => {
    for (const { node } of sets) {
      inNodeSpace(r, canvas, geometry, node, () => {
        const rect = r.ck.LTRBRect(0, 0, node.width, node.height)
        canvas.drawRRect(
          r.ck.RRectXY(rect, COMPONENT_SET_OUTLINE_RADIUS, COMPONENT_SET_OUTLINE_RADIUS),
          paint
        )
      })
    }
  })
}
