import { DEFAULT_FONT_FAMILY } from '../constants'
import { percentLength, pixelLength } from '../text/lengths'
import type { TextLength } from '../types'
import { dimension, parseCSSNumber } from './values'

/** A CSS escape: hex digits and one optional whitespace, an escaped line break, or any one character. */
const CSS_ESCAPE = /\\(?:([0-9a-fA-F]{1,6})(?:\r\n|[ \t\n\r\f])?|(?:\r\n|[\n\r\f])|([\s\S]))?/gu

/** The largest Unicode code point. */
const MAX_CODE_POINT = 0x10ffff

/** Text with its CSS escapes decoded; an escaped line break continues the line. */
function decodeCSSEscapes(text: string): string {
  return text.replace(CSS_ESCAPE, (_escape, hex: string | undefined, char: string | undefined) => {
    if (hex === undefined) return char ?? ''
    const codePoint = Number.parseInt(hex, 16)
    const surrogate = codePoint >= 0xd800 && codePoint <= 0xdfff
    return codePoint === 0 || surrogate || codePoint > MAX_CODE_POINT
      ? '\uFFFD'
      : String.fromCodePoint(codePoint)
  })
}

/** The index of the first unescaped `stop` character from `from`, or the text's length. */
function unescapedIndexOf(text: string, stop: string, from: number): number {
  let index = from
  while (index < text.length && text[index] !== stop) index += text[index] === '\\' ? 2 : 1
  return index
}

/** A family of a CSS `font-family` list: its name, and whether it was a quoted string. */
export interface CSSFontFamily {
  name: string
  quoted: boolean
}

/** The family at the start of `text` and where the next one starts, or null when none is left. */
function nextFontFamily(text: string): { family: CSSFontFamily | null; rest: string } | null {
  const trimmed = text.trimStart()
  if (!trimmed) return null
  const quote = trimmed[0]
  if (quote === '"' || quote === "'") {
    const end = unescapedIndexOf(trimmed, quote, 1)
    const name = decodeCSSEscapes(trimmed.slice(1, end))
    const comma = unescapedIndexOf(trimmed, ',', end)
    return { family: name ? { name, quoted: true } : null, rest: trimmed.slice(comma + 1) }
  }
  const comma = unescapedIndexOf(trimmed, ',', 0)
  const name = decodeCSSEscapes(trimmed.slice(0, comma)).trim().replace(/\s+/gu, ' ')
  return { family: name ? { name, quoted: false } : null, rest: trimmed.slice(comma + 1) }
}

/**
 * Every family of a CSS `font-family` list in order, without quotes and escapes, as
 * `parseCSSFontFamily` reads the first.
 */
export function parseCSSFontFamilies(value: string | undefined): CSSFontFamily[] {
  const families: CSSFontFamily[] = []
  for (let next = nextFontFamily(value ?? ''); next; next = nextFontFamily(next.rest)) {
    if (next.family) families.push(next.family)
  }
  return families
}

function firstFontFamily(value: string | undefined): CSSFontFamily | null {
  return parseCSSFontFamilies(value)[0] ?? null
}

/**
 * The real family a family of a `font-family` list names: a generic one, such as `sans-serif`,
 * mapped to a real one, and any other name as it is. A quoted name is never a generic.
 */
export function cssFontFamilyName(family: CSSFontFamily): string {
  if (family.quoted) return family.name
  return CSS_GENERIC_FONT_FAMILIES[family.name.toLowerCase()] ?? family.name
}

/**
 * The first family of a CSS `font-family` list, without its quotes and escapes. A family is a quoted
 * string or unquoted words, which join with single spaces; a quote opens a string only at the start
 * of the family, so a name list such as draw.io's keeps `O'Reilly`. Null for an empty list.
 */
export function parseCSSFontFamily(value: string | undefined): string | null {
  return firstFontFamily(value)?.name ?? null
}

const SANS_SERIF_FAMILY = DEFAULT_FONT_FAMILY
/** The families FigJam sets its Bookish and Technical typefaces in, which every font provider serves. */
const SERIF_FAMILY = 'Merriweather'
const MONOSPACE_FAMILY = 'Roboto Mono'

/**
 * Real families for CSS generic families, which name no font but whatever the browser picks for
 * them, and for `-apple-system` and `BlinkMacSystemFont`, which browsers read as `system-ui`.
 * Keyed by lowercase name; the rest of the generics, such as `cursive`, draw in the sans-serif one.
 */
export const CSS_GENERIC_FONT_FAMILIES: Readonly<Record<string, string>> = {
  serif: SERIF_FAMILY,
  'ui-serif': SERIF_FAMILY,
  monospace: MONOSPACE_FAMILY,
  'ui-monospace': MONOSPACE_FAMILY,
  'sans-serif': SANS_SERIF_FAMILY,
  'ui-sans-serif': SANS_SERIF_FAMILY,
  'ui-rounded': SANS_SERIF_FAMILY,
  'system-ui': SANS_SERIF_FAMILY,
  '-apple-system': SANS_SERIF_FAMILY,
  blinkmacsystemfont: SANS_SERIF_FAMILY,
  cursive: SANS_SERIF_FAMILY,
  fantasy: SANS_SERIF_FAMILY,
  math: SANS_SERIF_FAMILY,
  fangsong: SANS_SERIF_FAMILY
}

/**
 * The family a CSS `font-family` list sets text in: its first family, with a generic family
 * such as `sans-serif` or `system-ui` mapped to a real one. A quoted name is a family's own name,
 * never a generic. Null for an empty list.
 */
export function resolveCSSFontFamily(value: string | undefined): string | null {
  const family = firstFontFamily(value)
  return family ? cssFontFamilyName(family) : null
}

/**
 * A CSS `line-height` as a text length: a unitless multiple, `em`, or a percent follows the font size,
 * as a percent does in Figma; pixels stay pixels; `normal` is automatic, a null. Undefined for a
 * value it cannot read.
 */
export function parseCSSLineHeight(value: string | undefined): TextLength | null | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  if (trimmed === 'normal') return null
  const parsed = dimension(trimmed)
  if (parsed?.unit === '' || parsed?.unit === 'em') return percentLength(parsed.number * 100)
  if (parsed?.unit === '%') return percentLength(parsed.number)
  const pixels = parseCSSNumber(trimmed)
  return pixels === null ? undefined : pixelLength(pixels)
}

/**
 * A CSS `letter-spacing` as a text length: `em` is a percent of the font size, pixels stay pixels,
 * and `normal` is none. Undefined for a value it cannot read.
 */
export function parseCSSLetterSpacing(value: string | undefined): TextLength | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  if (trimmed === 'normal') return pixelLength(0)
  const parsed = dimension(trimmed)
  if (parsed?.unit === 'em') return percentLength(parsed.number * 100)
  const pixels = parseCSSNumber(trimmed)
  return pixels === null ? undefined : pixelLength(pixels)
}
