import {
  FONT_WEIGHT_NAMES,
  namesWeight,
  normalizeFontFamily,
  type FontFamilyStyle,
  parseFontStyle
} from '@open-pencil/scene-graph/font-style'

const FONT_WEIGHTS = Object.keys(FONT_WEIGHT_NAMES)
  .map(Number)
  .toSorted((a, b) => a - b)

/**
 * Font weights in the order CSS font matching tries them for `weight`, as Skia picks a face
 * from a family: heavier first above 500, lighter first below 400, and from 400 to 500 the
 * weights up to 500, then lighter, then heavier.
 */
export function fontWeightMatchOrder(weight: number): number[] {
  const lighter = FONT_WEIGHTS.filter((candidate) => candidate < weight).toReversed()
  const heavier = FONT_WEIGHTS.filter((candidate) => candidate > weight)
  const own = FONT_WEIGHTS.includes(weight) ? [weight] : []
  if (weight > 500) return [...own, ...heavier, ...lighter]
  if (weight < 400) return [...own, ...lighter, ...heavier]
  const upTo500 = heavier.filter((candidate) => candidate <= 500)
  return [...own, ...upTo500, ...lighter, ...heavier.filter((candidate) => candidate > 500)]
}

/**
 * A local font for a family and style. A style asked for is matched exactly, by name or by
 * weight and slant, since the face is registered as that style; without one, the face CSS
 * font matching would pick for the regular style.
 */
export function chooseLocalFontMatch<T extends FontFamilyStyle>(
  fonts: T[],
  family: string,
  style?: string
): T | undefined {
  const families = [family]
  const normalized = normalizeFontFamily(family)
  if (normalized !== family) families.push(normalized)
  const requested = parseFontStyle(style)

  for (const candidateFamily of families) {
    const exact = style
      ? fonts.find((font) => font.family === candidateFamily && font.style === style)
      : undefined
    if (exact) return exact
    // A face named apart from its weight is that face or none, never another of its weight.
    if (style && !namesWeight(style)) continue

    const candidates = fonts.filter((font) => font.family === candidateFamily)
    const sameStyle = candidates.find((font) => {
      const parsed = parseFontStyle(font.style)
      return parsed.weight === requested.weight && parsed.italic === requested.italic
    })
    if (sameStyle) return sameStyle
    if (style) continue

    for (const italic of [requested.italic, !requested.italic]) {
      for (const weight of fontWeightMatchOrder(requested.weight)) {
        const match = candidates.find((font) => {
          const parsed = parseFontStyle(font.style)
          return parsed.weight === weight && parsed.italic === italic
        })
        if (match) return match
      }
    }
    if (candidates.length > 0) return candidates[0]
  }

  return undefined
}
