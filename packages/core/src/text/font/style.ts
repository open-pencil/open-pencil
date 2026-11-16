import { partition, uniq } from 'es-toolkit'

import {
  FONT_WEIGHT_NAMES,
  namesWeight,
  namesWidth,
  normalizeFontFamily,
  type FontFamilyStyle,
  parseFontStyle,
  styleSpelling
} from '@open-pencil/scene-graph/font-style'

const FONT_WEIGHTS = Object.keys(FONT_WEIGHT_NAMES)
  .map(Number)
  .toSorted((a, b) => a - b)

/**
 * Font weights in the order CSS font matching tries them for `weight`, as Skia picks a face
 * from a family: heavier first above 500, lighter first below 400, and from 400 to 500 the
 * weights up to 500, then lighter, then heavier. Each weight's order is worked out once, since
 * every face lookup of a text run asks for it.
 */
export function fontWeightMatchOrder(weight: number): readonly number[] {
  let order = matchOrders.get(weight)
  if (!order) {
    order = matchOrder(weight)
    matchOrders.set(weight, order)
  }
  return order
}

const matchOrders = new Map<number, readonly number[]>()

function matchOrder(weight: number): number[] {
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
  return uniq([family, normalizeFontFamily(family)])
    .map((candidate) => matchInFamily(fonts, candidate, style))
    .find((match) => match !== undefined)
}

function matchInFamily<T extends FontFamilyStyle>(
  fonts: T[],
  family: string,
  style?: string
): T | undefined {
  const exact = style
    ? fonts.find((font) => font.family === family && font.style === style)
    : undefined
  if (exact) return exact
  // A face named apart from its weight is that face or none, never another of its weight.
  if (style && !namesWeight(style)) return undefined

  const requested = parseFontStyle(style)
  const candidates = normalWidthFirst(fonts.filter((font) => font.family === family))
  const sameStyle = candidates.find((font) => {
    const parsed = parseFontStyle(font.style)
    return parsed.weight === requested.weight && parsed.italic === requested.italic
  })
  if (sameStyle || style) return sameStyle

  for (const italic of [requested.italic, !requested.italic]) {
    for (const weight of fontWeightMatchOrder(requested.weight)) {
      const match = candidates.find((font) => {
        const parsed = parseFontStyle(font.style)
        return parsed.weight === weight && parsed.italic === italic
      })
      if (match) return match
    }
  }
  return candidates.at(0)
}

function normalWidthFirst<T extends FontFamilyStyle>(fonts: T[]): T[] {
  const [normalWidth, otherWidth] = partition(fonts, (font) => !namesWidth(font.style))
  return [...normalWidth, ...otherWidth]
}

export interface NamedLocalFont extends FontFamilyStyle {
  fullName: string
}

function fontByFullName<T extends NamedLocalFont>(fonts: readonly T[], fullName: string) {
  const wanted = styleSpelling(fullName)
  return fonts.find((font) => styleSpelling(font.fullName) === wanted)
}

/**
 * The local font listed under `family` for `style`, else the one whose full name is the family
 * and style, as Windows lists a face beyond regular, bold, and italic as a family of its own.
 * The family is taken as given; {@link findLocalFont} also tries the name it normalizes to.
 */
export function listedLocalFont<T extends NamedLocalFont>(
  fonts: T[],
  family: string,
  style?: string
): T | undefined {
  return (
    matchInFamily(fonts, family, style) ??
    (style ? fontByFullName(fonts, `${family} ${style}`) : undefined)
  )
}

/** The local font listed for a family and style, under the family or the name it normalizes to. */
export function findLocalFont<T extends NamedLocalFont>(
  fonts: T[],
  family: string,
  style?: string
): T | undefined {
  return uniq([family, normalizeFontFamily(family)])
    .map((candidate) => listedLocalFont(fonts, candidate, style))
    .find((match) => match !== undefined)
}
