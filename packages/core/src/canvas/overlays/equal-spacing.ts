// The gaps Figma's equal spacing matched during a move: each a line with a tick at both ends and a
// label with its length.
import type { Canvas } from '@open-pencil/canvaskit'
import type { SnapGuide } from '@open-pencil/scene-graph/snap'

import { drawMeasurementSegment } from '#core/canvas/overlays/measurement'
import type { SkiaRenderer } from '#core/canvas/renderer/skia'
import { worldXToScreen, worldYToScreen } from '#core/geometry/viewport'

/** Half the length of the ticks closing a gap, in screen pixels. */
const GAP_TICK_HALF_LENGTH = 4

function drawGapTicks(r: SkiaRenderer, canvas: Canvas, guide: SnapGuide): void {
  const paint = r.snapPaint
  if (guide.axis === 'x') {
    const y = worldYToScreen(r, guide.position)
    for (const end of [guide.from, guide.to]) {
      const x = worldXToScreen(r, end)
      canvas.drawLine(x, y - GAP_TICK_HALF_LENGTH, x, y + GAP_TICK_HALF_LENGTH, paint)
    }
  } else {
    const x = worldXToScreen(r, guide.position)
    for (const end of [guide.from, guide.to]) {
      const y = worldYToScreen(r, end)
      canvas.drawLine(x - GAP_TICK_HALF_LENGTH, y, x + GAP_TICK_HALF_LENGTH, y, paint)
    }
  }
}

/** Draws the snap guides that are equal-spacing gaps; `drawSnapGuides` leaves them to this. */
export function drawSpacingGuides(r: SkiaRenderer, canvas: Canvas, guides?: SnapGuide[]): void {
  for (const guide of guides ?? []) {
    if (guide.spacing === undefined) continue
    drawMeasurementSegment(r, canvas, {
      axis: guide.axis,
      from: guide.from,
      to: guide.to,
      cross: guide.position,
      value: guide.spacing
    })
    drawGapTicks(r, canvas, guide)
  }
}
