import type { TextDecoration, TextLength } from '@open-pencil/scene-graph'
import { NO_LETTER_SPACING, percentLength, pixelLength } from '@open-pencil/scene-graph/text'

export function mapTextDecoration(d?: string): TextDecoration {
  switch (d) {
    case 'UNDERLINE':
      return 'UNDERLINE'
    case 'STRIKETHROUGH':
      return 'STRIKETHROUGH'
    default:
      return 'NONE'
  }
}

/** How Figma writes an auto line height; a percent the user set is a `RAW` multiplier. */
export const FIGMA_AUTO_LINE_HEIGHT = { value: 100, units: 'PERCENT' } as const

export function isFigmaAutoLineHeight(lh?: { value: number; units: string }): boolean {
  return lh?.units === FIGMA_AUTO_LINE_HEIGHT.units && lh.value === FIGMA_AUTO_LINE_HEIGHT.value
}

/**
 * A line height as the scene keeps it: null for auto, pixels as pixels, and a percent or the
 * multiplier Figma writes for one as a percent, so it follows the font size as in Figma.
 */
export function convertLineHeight(lh?: { value: number; units: string }): TextLength | null {
  if (!lh || isFigmaAutoLineHeight(lh)) return null
  if (lh.units === 'PIXELS') return pixelLength(lh.value)
  if (lh.units === 'PERCENT') return percentLength(lh.value)
  if (lh.units === 'RAW') return percentLength(lh.value * 100)
  return null
}

/** A letter spacing as the scene keeps it, in pixels or a percent of the font size. */
export function convertLetterSpacing(ls?: { value: number; units: string }): TextLength {
  if (!ls) return NO_LETTER_SPACING
  return ls.units === 'PIXELS' ? pixelLength(ls.value) : percentLength(ls.value)
}

/** A line height as Figma writes it: auto as 100 percent, and a percent as a `RAW` multiplier. */
export function figmaLineHeight(lineHeight: TextLength | null): { value: number; units: string } {
  if (!lineHeight) return { ...FIGMA_AUTO_LINE_HEIGHT }
  return lineHeight.unit === 'PIXELS'
    ? { value: lineHeight.value, units: 'PIXELS' }
    : { value: lineHeight.value / 100, units: 'RAW' }
}

/** A letter spacing as Figma writes it. */
export function figmaLetterSpacing(letterSpacing: TextLength): { value: number; units: string } {
  return { value: letterSpacing.value, units: letterSpacing.unit }
}
