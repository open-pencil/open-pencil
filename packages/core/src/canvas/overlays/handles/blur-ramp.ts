import type { Canvas } from '@open-pencil/canvaskit'
import type { SceneGraph } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { editedBlurRampLayout } from '#core/editor/handles/blur-ramp'
import type { BlurRampEdit } from '#core/editor/types'
import type { RotationPreview } from '#core/geometry'

import { drawDot, polyline, strokeWithShadow } from './gradient'

/**
 * Figma's on-canvas progressive blur handles, shown while the blur's settings are open: a white
 * line from its start to its end, with a dot on each.
 */
export function drawBlurRampHandles(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  edit: BlurRampEdit | null | undefined,
  preview?: RotationPreview | null
): void {
  const layout = editedBlurRampLayout(graph, edit, r, preview)
  if (!layout) return
  strokeWithShadow(r, canvas, polyline(r, [layout.start, layout.end], false))
  drawDot(r, canvas, layout.start)
  drawDot(r, canvas, layout.end)
}
