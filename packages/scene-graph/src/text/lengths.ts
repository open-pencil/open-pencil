import type { TextLength } from '../types'

/** No letter spacing, as a new text has it and as Figma writes it. */
export const NO_LETTER_SPACING: TextLength = { value: 0, unit: 'PERCENT' }

/** `length` in pixels at `fontSize`. */
export function textLengthPixels(length: TextLength, fontSize: number): number {
  return length.unit === 'PIXELS' ? length.value : (length.value / 100) * fontSize
}

/** A line height in pixels at `fontSize`, or null when it is automatic. */
export function lineHeightPixels(lineHeight: TextLength | null, fontSize: number): number | null {
  return lineHeight ? textLengthPixels(lineHeight, fontSize) : null
}

/** A length in pixels, as a bound number variable and most authored formats give one. */
export function pixelLength(value: number): TextLength {
  return { value, unit: 'PIXELS' }
}

/** A length as a percent of the font size. */
export function percentLength(value: number): TextLength {
  return { value, unit: 'PERCENT' }
}

/** `length` scaled by `factor`: pixels scale, a percent already follows the font size. */
export function scaledTextLength(length: TextLength, factor: number): TextLength {
  return length.unit === 'PIXELS' ? pixelLength(length.value * factor) : length
}

/** `length` as people read it: `24px` or `150%`. */
export function formatTextLength(length: TextLength): string {
  return length.unit === 'PIXELS' ? `${length.value}px` : `${length.value}%`
}
