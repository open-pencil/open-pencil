import { percentLength } from '../text/lengths'
import type { SceneNode } from '../types'

/**
 * FigJam's text sizes for sticky notes and shapes, each with the tracking it sets, as a percent
 * of the size; the line stays one and a half times the size.
 */
export const FIGJAM_TEXT_SIZES = {
  small: { fontSize: 16, tracking: -1.1 },
  medium: { fontSize: 24, tracking: -1.9 },
  large: { fontSize: 40, tracking: -2.2 },
  extraLarge: { fontSize: 64, tracking: -2.2 },
  huge: { fontSize: 96, tracking: -2.3 }
} as const

export type FigJamTextSize = keyof typeof FIGJAM_TEXT_SIZES

/**
 * FigJam's typefaces, as its text menus name them, and the face each sets. Scribbled is Figma's
 * own hand font, which FigJam sets without tracking.
 */
export const FIGJAM_TYPEFACES = {
  simple: { fontFamily: 'Inter', fontWeight: 500, tracked: true },
  bookish: { fontFamily: 'Merriweather', fontWeight: 400, tracked: true },
  technical: { fontFamily: 'Roboto Mono', fontWeight: 500, tracked: true },
  scribbled: { fontFamily: 'Figma Hand', fontWeight: 400, tracked: false }
} as const

export type FigJamTypeface = keyof typeof FIGJAM_TYPEFACES

export function isFigJamTypeface(value: unknown): value is FigJamTypeface {
  return typeof value === 'string' && Object.hasOwn(FIGJAM_TYPEFACES, value)
}

/** Text at a size preset in `typeface`. */
export function figJamTextSizeFields(
  size: FigJamTextSize,
  typeface: FigJamTypeface = 'simple'
): Partial<SceneNode> {
  const { fontSize, tracking } = FIGJAM_TEXT_SIZES[size]
  const tracked = FIGJAM_TYPEFACES[typeface].tracked
  return {
    fontSize,
    // FigJam writes both relative to the size, a line at 150% and tracking in percent.
    lineHeight: percentLength(150),
    letterSpacing: percentLength(tracked ? tracking : 0)
  }
}

/** The preset a text is closest to, as FigJam's size menu shows a rescaled one. */
export function figJamTextSize(text: Pick<SceneNode, 'fontSize'>): FigJamTextSize {
  const sizes = Object.entries(FIGJAM_TEXT_SIZES) as [FigJamTextSize, { fontSize: number }][]
  return sizes.reduce((best, entry) =>
    Math.abs(entry[1].fontSize - text.fontSize) < Math.abs(best[1].fontSize - text.fontSize)
      ? entry
      : best
  )[0]
}

/** The typeface a text is set in, or null for a face FigJam's menu does not offer. */
export function figJamTypeface(text: Pick<SceneNode, 'fontFamily'>): FigJamTypeface | null {
  const entries = Object.entries(FIGJAM_TYPEFACES) as [FigJamTypeface, { fontFamily: string }][]
  return entries.find(([, face]) => face.fontFamily === text.fontFamily)?.[0] ?? null
}

/** Text set in `typeface` at its current size, as FigJam's typeface menu sets it. */
export function figJamTypefaceFields(
  typeface: FigJamTypeface,
  text: Pick<SceneNode, 'fontSize'>
): Partial<SceneNode> {
  const { fontFamily, fontWeight } = FIGJAM_TYPEFACES[typeface]
  return {
    fontFamily,
    fontWeight,
    italic: false,
    ...figJamTextSizeFields(figJamTextSize(text), typeface)
  }
}
