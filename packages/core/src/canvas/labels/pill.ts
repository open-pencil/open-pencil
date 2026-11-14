import type { Canvas, Color, Font } from '@open-pencil/canvaskit'

import type { SkiaRenderer } from '#core/canvas/renderer'

import { cachedGlyphWidth } from './paragraph-cache'

/** A value the chrome shows in a rounded pill as wide as its text, centred on `centerX`. */
export interface TextPill {
  text: string
  font: Font
  centerX: number
  /** The pill's top edge, in screen pixels. */
  top: number
  height: number
  paddingX: number
  radius: number
  /** How far below the pill's top its text's baseline sits. */
  baseline: number
  fill: Color
  textColor: Color
}

/** Draws a text pill: the rounded box, then its text on the baseline, past the left padding. */
export function drawTextPill(
  r: Pick<SkiaRenderer, 'ck' | 'auxFill' | 'glyphWidths'>,
  canvas: Canvas,
  pill: TextPill
): void {
  const width = cachedGlyphWidth(r, pill.font, pill.text) + pill.paddingX * 2
  const left = pill.centerX - width / 2
  r.auxFill.setColor(pill.fill)
  canvas.drawRRect(
    r.ck.RRectXY(
      r.ck.LTRBRect(left, pill.top, left + width, pill.top + pill.height),
      pill.radius,
      pill.radius
    ),
    r.auxFill
  )
  r.auxFill.setColor(pill.textColor)
  canvas.drawText(pill.text, left + pill.paddingX, pill.top + pill.baseline, r.auxFill, pill.font)
}
