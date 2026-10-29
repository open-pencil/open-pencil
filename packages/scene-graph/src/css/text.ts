import valueParser from 'postcss-value-parser'

import { percentLength, pixelLength } from '../text/lengths'
import type { TextLength } from '../types'
import { parseCSSNumber } from './values'

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

/**
 * The first family of a CSS `font-family` list, without its quotes and escapes. A family is a quoted
 * string or unquoted words, which join with single spaces; a quote opens a string only at the start
 * of the family, so a name list such as draw.io's keeps `O'Reilly`. Null for an empty list.
 */
export function parseCSSFontFamily(value: string | undefined): string | null {
  const text = value?.trimStart()
  if (!text) return null
  const quote = text[0]
  if (quote === '"' || quote === "'") {
    return decodeCSSEscapes(text.slice(1, unescapedIndexOf(text, quote, 1))) || null
  }
  const words = decodeCSSEscapes(text.slice(0, unescapedIndexOf(text, ',', 0)))
  return words.trim().replace(/\s+/gu, ' ') || null
}

/** A CSS dimension's number and lowercase unit, or null. */
function dimension(value: string): { number: number; unit: string } | null {
  const parsed = valueParser.unit(value)
  if (!parsed) return null
  const number = Number(parsed.number)
  return Number.isFinite(number) ? { number, unit: parsed.unit.toLowerCase() } : null
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
