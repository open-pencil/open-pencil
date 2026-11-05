import type { VisualBounds } from '@open-pencil/scene-graph/geometry'

import type { OutlineCommand } from './font/glyphs'
import { KEYCAP_FRAME } from './font/keycap'

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

/** The keycap frame's box in em: a rounded rectangle, whose outermost points lie on it. */
const KEYCAP_FRAME_BOX = (() => {
  const xs = KEYCAP_FRAME.flatMap((command) => [command.x, command.x1, command.x2])
  const ys = KEYCAP_FRAME.flatMap((command) => [command.y, command.y1, command.y2])
  const numbers = (values: Array<number | undefined>) =>
    values.filter((value): value is number => value !== undefined)
  return {
    minX: Math.min(...numbers(xs)),
    minY: Math.min(...numbers(ys)),
    maxX: Math.max(...numbers(xs)),
    maxY: Math.max(...numbers(ys))
  }
})()

/** The box `keycapFrame(size)` draws in, y down from the baseline, centred on the pen. */
export function keycapFrameBounds(size: number): VisualBounds {
  return {
    minX: KEYCAP_FRAME_BOX.minX * size,
    minY: KEYCAP_FRAME_BOX.minY * size,
    maxX: KEYCAP_FRAME_BOX.maxX * size,
    maxY: KEYCAP_FRAME_BOX.maxY * size
  }
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
