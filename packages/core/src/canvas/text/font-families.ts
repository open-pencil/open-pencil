import { uniq } from 'es-toolkit/array'

import type { FontVariation } from '@open-pencil/scene-graph'
import { weightToStyle } from '@open-pencil/scene-graph/font-style'

import { ResourceCache } from '#core/cache/resource'
import { DEFAULT_FONT_FAMILY } from '#core/constants'
import { EMOJI_METRICS_FAMILY } from '#core/text/emoji'
import type { FamilyFace } from '#core/text/font/faces'
import { fontManager, fontWeightMatchOrder } from '#core/text/fonts'

const familiesCache = new ResourceCache<string, string[]>({ maxEntries: 256 })

/** What decides the axis values of a variable font text is drawn in. */
export interface DrawnFontAxes {
  family: string
  weight: number
  italic: boolean
  fontSize: number
  /** The axes the text sets. */
  variations: readonly FontVariation[]
  opticalSizeFromFontSize: boolean
}

/**
 * The axis values text is drawn at, as Figma draws a variable font: its style's named instance,
 * then the axes it sets. While the optical size follows the font size, `opsz` is the font size and
 * a stored `opsz` is ignored. Fonts without an axis ignore its value.
 */
export function drawnFontVariations(font: DrawnFontAxes): FontVariation[] {
  const named =
    fontManager.namedInstanceVariations(font.family, weightToStyle(font.weight, font.italic)) ?? []
  const set = font.opticalSizeFromFontSize
    ? [
        ...font.variations.filter((variation) => variation.axis !== 'opsz'),
        { axis: 'opsz', value: font.fontSize }
      ]
    : font.variations
  const axes = new Map([...named, ...set].map(({ axis, value }) => [axis, value]))
  return [...axes].map(([axis, value]) => ({ axis, value }))
}

/**
 * The loaded face of a family that text asking for a style is drawn in: that style, or the
 * nearest loaded weight in the same slant, then the other, as font matching picks it; `null`
 * when the family has none loaded.
 */
export function loadedFace(family: string, weight: number, italic: boolean): FamilyFace | null {
  for (const slant of [italic, !italic]) {
    for (const candidate of fontWeightMatchOrder(weight)) {
      if (fontManager.isStyleLoaded(family, weightToStyle(candidate, slant)))
        return { weight: candidate, italic: slant }
    }
  }
  return null
}

export function resolveParagraphFontFamilies(
  primary: string,
  style: string,
  arabicFallbacks: readonly string[] = fontManager.getArabicFallbackFamilies(),
  cjkFallbacks: readonly string[] = fontManager.getCJKFallbackFamilies()
): string[] {
  const renderPrimary = fontManager.renderFamily(primary, style)
  const renderArabicFallbacks = arabicFallbacks.map((family) =>
    fontManager.renderFamily(family, 'Regular')
  )
  const renderCJKFallbacks = cjkFallbacks.map((family) =>
    fontManager.renderFamily(family, 'Regular')
  )
  const key = `${renderPrimary}\0${renderArabicFallbacks.join('\0')}\0${renderCJKFallbacks.join('\0')}`
  const cached = familiesCache.peek(key)
  if (cached) return cached
  const families = [renderPrimary]
  if (primary !== DEFAULT_FONT_FAMILY) families.push(DEFAULT_FONT_FAMILY)
  // Emoji come last, so a character a script's font has stays in that font.
  families.push(...renderArabicFallbacks, ...renderCJKFallbacks, EMOJI_METRICS_FAMILY)
  const resolved = uniq(families)
  familiesCache.set(key, resolved)
  return resolved
}
