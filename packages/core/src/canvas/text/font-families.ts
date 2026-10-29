import { uniq } from 'es-toolkit/array'

import type { FontVariation } from '@open-pencil/scene-graph'
import { parseFontStyle, weightToStyle } from '@open-pencil/scene-graph/font-style'

import { ResourceCache } from '#core/cache/resource'
import { DEFAULT_FONT_FAMILY } from '#core/constants'
import { EMOJI_METRICS_FAMILY } from '#core/text/emoji'
import type { FamilyFace } from '#core/text/font/faces'
import type { FontAxis } from '#core/text/font/variation'
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

/** An axis of the variable font text is drawn in, with the value it is drawn at. */
export interface DrawnFontAxis extends FontAxis {
  value: number
}

/**
 * The axes of the variable font text is drawn in, in the font's order, each at the value it is
 * drawn at, within its range. `null` when the family's loaded faces are static or it has none.
 */
export function drawnFontAxes(font: DrawnFontAxes): DrawnFontAxis[] | null {
  const variation = fontManager.familyVariation(font.family, font.italic)
  if (!variation) return null
  const drawn = new Map(drawnFontVariations(font).map(({ axis, value }) => [axis, value]))
  return variation.axes.map((axis) => ({
    ...axis,
    value: Math.min(axis.max, Math.max(axis.min, drawn.get(axis.tag) ?? axis.default))
  }))
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

/**
 * The families a paragraph's text falls back through, by their own names: its family, the
 * default family, the Arabic and CJK fallbacks, then emoji, so a character a script's font has
 * stays in that font. Fonts are read by these names; CanvasKit is asked for them as
 * {@link resolveParagraphFontFamilies} names them.
 */
export function paragraphSourceFamilies(
  primary: string,
  arabicFallbacks: readonly string[] = fontManager.getArabicFallbackFamilies(),
  cjkFallbacks: readonly string[] = fontManager.getCJKFallbackFamilies()
): string[] {
  return uniq([
    primary,
    ...(primary === DEFAULT_FONT_FAMILY ? [] : [DEFAULT_FONT_FAMILY]),
    ...arabicFallbacks,
    ...cjkFallbacks,
    EMOJI_METRICS_FAMILY
  ])
}

/** `style` of `family` by the names CanvasKit draws it under: its own file, then its shards. */
function renderFamilies(family: string, style: string): string[] {
  return [
    fontManager.renderFamily(family, style),
    ...fontManager.renderShardFamilies(family, style)
  ]
}

/**
 * The paragraph's families as CanvasKit is asked for them: the family in the face it draws the
 * style in, and its fallbacks, each by the names `renderFamilies` gives it.
 */
export function resolveParagraphFontFamilies(
  primary: string,
  style: string,
  arabicFallbacks: readonly string[] = fontManager.getArabicFallbackFamilies(),
  cjkFallbacks: readonly string[] = fontManager.getCJKFallbackFamilies()
): string[] {
  // The face the family draws the style in, which may be the nearest one loaded.
  const asked = parseFontStyle(style)
  const drawn = loadedFace(primary, asked.weight, asked.italic)
  const renderPrimary = renderFamilies(
    primary,
    drawn ? weightToStyle(drawn.weight, drawn.italic) : style
  )
  const renderArabicFallbacks = arabicFallbacks.flatMap((family) =>
    renderFamilies(family, 'Regular')
  )
  const renderCJKFallbacks = cjkFallbacks.flatMap((family) => renderFamilies(family, 'Regular'))
  const key = [
    primary,
    ...renderPrimary,
    '',
    ...renderArabicFallbacks,
    '',
    ...renderCJKFallbacks
  ].join('\0')
  const cached = familiesCache.peek(key)
  if (cached) return cached
  const resolved = uniq([
    ...renderPrimary,
    ...(primary === DEFAULT_FONT_FAMILY ? [] : [DEFAULT_FONT_FAMILY]),
    ...renderArabicFallbacks,
    ...renderCJKFallbacks,
    EMOJI_METRICS_FAMILY
  ])
  familiesCache.set(key, resolved)
  return resolved
}
