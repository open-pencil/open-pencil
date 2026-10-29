import type { Font } from 'canvaskit-wasm'

import { ELLIPSIS } from '#core/text/ellipsis'

export function measureLabelText(font: Font, text: string): number {
  const glyphIds = font.getGlyphIDs(text)
  const widths = font.getGlyphWidths(glyphIds)
  let result = 0
  for (const width of widths) result += width
  return result
}

export function ellipsizeLabelText(font: Font, text: string, maxWidth: number): string {
  if (maxWidth <= 0) return ''
  if (measureLabelText(font, text) <= maxWidth) return text

  const ellipsisWidth = measureLabelText(font, ELLIPSIS)
  if (maxWidth <= ellipsisWidth) return ELLIPSIS

  let width = 0
  let end = 0
  const glyphIds = font.getGlyphIDs(text)
  const widths = font.getGlyphWidths(glyphIds)
  for (let index = 0; index < widths.length; index++) {
    if (width + widths[index] + ellipsisWidth > maxWidth) break
    width += widths[index]
    end = index + 1
  }
  return text.slice(0, end) + ELLIPSIS
}
