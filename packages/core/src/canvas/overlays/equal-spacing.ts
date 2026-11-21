// The gaps Figma's equal spacing matched during a move: each a line with a tick at both ends and a
// label with its length.
import type { Canvas, Paint } from '@open-pencil/canvaskit'
import type { SnapGuide } from '@open-pencil/scene-graph/snap'

import { drawMeasurementSegment } from '#core/canvas/overlays/measurement'
import type { SkiaRenderer } from '#core/canvas/renderer/skia'
import { worldXToScreen, worldYToScreen } from '#core/geometry/viewport'

/** Half the length of the ticks closing a gap, in screen pixels. */
const GAP_TICK_HALF_LENGTH = 4

/**
 * A tick across the gap's line: `along` is where it sits on the guide's axis and `across` where the
 * line runs, both in screen pixels.
 */
function drawTick(
  canvas: Canvas,
  paint: Paint,
  axis: SnapGuide['axis'],
  along: number,
  across: number
): void {
  if (axis === 'x') {
    canvas.drawLine(
      along,
      across - GAP_TICK_HALF_LENGTH,
      along,
      across + GAP_TICK_HALF_LENGTH,
      paint
    )
    return
  }

  canvas.drawLine(across - GAP_TICK_HALF_LENGTH, along, across + GAP_TICK_HALF_LENGTH, along, paint)
}

/** Closes the gap with a tick at both ends. */
function drawGapTicks(r: SkiaRenderer, canvas: Canvas, guide: SnapGuide): void {
  const toAlong = guide.axis === 'x' ? worldXToScreen : worldYToScreen
  const toAcross = guide.axis === 'x' ? worldYToScreen : worldXToScreen
  const across = toAcross(r, guide.position)
  for (const end of [guide.from, guide.to]) {
    drawTick(canvas, r.snapPaint, guide.axis, toAlong(r, end), across)
  }
}

/** A snap guide that is an equal-spacing gap, with its length. */
type GapGuide = SnapGuide & { spacing: number }

function isGap(guide: SnapGuide): guide is GapGuide {
  return guide.spacing !== undefined
}

/** Draws the snap guides that are equal-spacing gaps; `drawSnapGuides` leaves them to this. */
export function drawSpacingGuides(r: SkiaRenderer, canvas: Canvas, guides?: SnapGuide[]): void {
  const gaps = (guides ?? []).filter(isGap)
  // Every gap's ticks go under the labels: a small gap zoomed out puts its ticks, or a neighbor's,
  // over the label's numerals.
  for (const gap of gaps) drawGapTicks(r, canvas, gap)
  for (const gap of gaps) {
    drawMeasurementSegment(r, canvas, {
      axis: gap.axis,
      from: gap.from,
      to: gap.to,
      cross: gap.position,
      value: gap.spacing
    })
  }
}
