import type { Canvas, CanvasKit, Paint } from 'canvaskit-wasm'

import type { OutlineCommand } from '#core/text/font/glyphs'
import { KEYCAP_FRAME } from '#core/text/keycap'

import { appendOutlineCommand } from './outline-path'

/** The combining enclosing keycap, which draws a frame around the character before it. */
export const COMBINING_KEYCAP = '⃣'

/** What the keycap mark becomes for layout: nothing to draw, and as long in UTF-16 and UTF-8. */
const ZERO_WIDTH_SPACE = '​'

/**
 * Text as CanvasKit lays it out. CanvasKit shapes a keycap mark with the font of the character it
 * frames, and a text font has no glyph for it, so the mark is laid out as a zero-width space and
 * its frame drawn apart, as Figma draws it from Noto Sans Symbols. Offsets do not move.
 */
export function laidOutText(text: string): string {
  return text.includes(COMBINING_KEYCAP)
    ? text.replaceAll(COMBINING_KEYCAP, ZERO_WIDTH_SPACE)
    : text
}

/** The keycap frame in pixels at `size`, y down from the baseline, centred on the pen. */
export function keycapFrame(size: number): OutlineCommand[] {
  return KEYCAP_FRAME.map((command) => {
    const scaled: OutlineCommand = { type: command.type }
    for (const key of ['x', 'y', 'x1', 'y1', 'x2', 'y2'] as const) {
      const value = command[key]
      if (value !== undefined) scaled[key] = value * size
    }
    return scaled
  })
}

/** Draws a keycap frame with `paint`, its pen at `x` on the baseline `y`. */
export function drawKeycapFrame(
  ck: CanvasKit,
  canvas: Canvas,
  x: number,
  y: number,
  size: number,
  paint: Paint
): void {
  const builder = new ck.PathBuilder()
  for (const command of keycapFrame(size)) appendOutlineCommand(builder, command, x, y)
  const path = builder.detachAndDelete()
  try {
    canvas.drawPath(path, paint)
  } finally {
    path.delete()
  }
}
