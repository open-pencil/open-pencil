import { uniq } from 'es-toolkit/array'

import type { FontVariation } from '@open-pencil/scene-graph'
import { faceLoadKey } from '@open-pencil/scene-graph/font-style'

import { ResourceCache } from '#core/cache/resource'
import { DEFAULT_FONT_FAMILY } from '#core/constants'
import { EMOJI_METRICS_FAMILY } from '#core/text/emoji'
import type { FaceWeight } from '#core/text/font/faces'
import { fontManager } from '#core/text/font/manager'
import { fontWeightMatchOrder } from '#core/text/font/style'
import type { FontAxis } from '#core/text/font/variation'

const familiesCache = new ResourceCache<string, string[]>({ maxEntries: 256 })

/** What decides the axis values of a variable font text is drawn in. */
export interface DrawnFontAxes {
  family: string
  weight: number
  italic: boolean
  /** The face's key, as {@link faceStyleKey} gives it; its weight's key when left out. */
  style?: string
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
  // A face named apart from its weight ("Condensed Bold") is the instance of that name.
  const weightKey = faceLoadKey(font.weight, font.italic)
  const named =
    fontManager.namedInstanceVariations(font.family, font.style ?? weightKey) ??
    fontManager.namedInstanceVariations(font.family, weightKey) ??
    []
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

/** A loaded face text is drawn in: its weight and slant, and the key it is loaded under. */
export interface LoadedFace extends FaceWeight {
  style: string
}

/**
 * The loaded face of a family that text asking for a face is drawn in: that face, by its key,
 * or the nearest loaded weight in the same slant, then the other, as font matching picks it;
 * `null` when the family has none loaded.
 */
export function loadedFace(
  family: string,
  weight: number,
  italic: boolean,
  style = faceLoadKey(weight, italic)
): LoadedFace | null {
  if (fontManager.isStyleLoaded(family, style)) return { weight, italic, style }
  for (const slant of [italic, !italic]) {
    for (const candidate of fontWeightMatchOrder(weight)) {
      const key = faceLoadKey(candidate, slant)
      if (fontManager.isStyleLoaded(family, key))
        return { weight: candidate, italic: slant, style: key }
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
 * face in, and its fallbacks, each by the names `renderFamilies` gives it.
 */
export function resolveParagraphFontFamilies(
  primary: string,
  face: { weight: number; italic: boolean; style: string },
  arabicFallbacks: readonly string[] = fontManager.getArabicFallbackFamilies(),
  cjkFallbacks: readonly string[] = fontManager.getCJKFallbackFamilies()
): string[] {
  // The face the family draws it in, which may be the nearest one loaded.
  const drawn = loadedFace(primary, face.weight, face.italic, face.style)
  const renderPrimary = renderFamilies(primary, drawn?.style ?? face.style)
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
