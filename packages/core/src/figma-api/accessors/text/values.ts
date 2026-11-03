import * as v from 'valibot'

import type {
  CharacterStyleOverride,
  Fill,
  TextCase,
  TextDecoration,
  TextDecorationStyle,
  TextLength
} from '@open-pencil/scene-graph'
import { textLengthPixels } from '@open-pencil/scene-graph/text'

import { parseFigmaPaints } from '#core/figma-api/paints'
import { atLeast, finiteNumberSchema, unitIntervalSchema } from '#core/figma-api/schema'
import { parseFigma } from '#core/figma-api/validation'

// The values text setters take, as Figma's schemas check them (Figma desktop 126).

export const DECORATIONS = new Set<TextDecoration>(['NONE', 'UNDERLINE', 'STRIKETHROUGH'])
export const DECORATION_STYLES = new Set<TextDecorationStyle>(['SOLID', 'DOTTED', 'WAVY'])
const LENGTH_UNITS = ['PIXELS', 'PERCENT'] as const
const TEXT_CASES = ['ORIGINAL', 'UPPER', 'LOWER', 'TITLE'] as const
/** Text cases Figma takes that OpenPencil cannot draw yet. */
const SMALL_CAPS = ['SMALL_CAPS', 'SMALL_CAPS_FORCED'] as const

/** A length in pixels for a font size: a percent is of the size of the characters it styles. */
export type SizedLength<T> = (fontSize: number) => T

/** `length` in pixels at the size of the characters it styles, for fields kept in pixels. */
export function sized(length: TextLength | null): SizedLength<number | null> {
  return (fontSize) => length && textLengthPixels(length, fontSize)
}

/** A size in pixels or a percent of the font size, as Figma's `LetterSpacing` and others are. */
const lengthSchema = v.strictObject({ value: finiteNumberSchema, unit: v.picklist(LENGTH_UNITS) })

/** A length that may also be automatic, as Figma's `LineHeight` and decoration sizes are. */
const lengthOrAutoSchema = v.variant('unit', [
  lengthSchema,
  v.strictObject({ unit: v.literal('AUTO') })
])

/** A solid paint, the one paint a decoration colour takes; a colour's alpha may be left out. */
const solidPaintSchema = v.strictObject({
  type: v.literal('SOLID'),
  color: v.strictObject({
    r: unitIntervalSchema,
    g: unitIntervalSchema,
    b: unitIntervalSchema,
    a: v.optional(unitIntervalSchema)
  }),
  opacity: v.optional(unitIntervalSchema),
  visible: v.optional(v.boolean()),
  blendMode: v.optional(v.string()),
  boundVariables: v.optional(v.unknown())
})

/** Figma's `TextDecorationColor`: automatic, following the text, or a solid paint. */
const decorationColorSchema = v.union([
  v.strictObject({ value: solidPaintSchema }),
  v.strictObject({ value: v.literal('AUTO') })
])

/** A font size Figma takes: a number of at least 1. */
export function fontSizeValue(method: string, value: unknown, property = 'value'): number {
  return parseFigma(atLeast(1), value, method, property)
}

/** A letter spacing Figma takes: pixels or percent, never automatic. */
export function letterSpacingLength(
  method: string,
  value: unknown,
  property = 'value'
): TextLength {
  return parseFigma(lengthSchema, value, method, property)
}

/** A length that may also be automatic, read as null, as line heights and decoration sizes are. */
export function lengthOrAuto(
  method: string,
  value: unknown,
  property = 'value'
): TextLength | null {
  const length = parseFigma(lengthOrAutoSchema, value, method, property)
  return length.unit === 'AUTO' ? null : length
}

/** A range's fills, checked as `fills` checks them. */
export function fillsFromPaints(method: string, value: unknown): CharacterStyleOverride['fills'] {
  return parseFigmaPaints(value, method, 'value')
}

/** The fills a decoration colour gives: none for automatic, else its solid paint. */
export function decorationColorFills(method: string, value: unknown): Fill[] {
  const color = parseFigma(decorationColorSchema, value, method, 'textDecorationColor').value
  return color === 'AUTO' ? [] : parseFigmaPaints([color], method, 'textDecorationColor')
}

/** A text case Figma takes; it takes small caps too, which OpenPencil cannot draw yet. */
export function textCaseValue(method: string, value: unknown, property = 'value'): TextCase {
  const textCase = parseFigma(v.picklist([...TEXT_CASES, ...SMALL_CAPS]), value, method, property)
  if (textCase === 'SMALL_CAPS' || textCase === 'SMALL_CAPS_FORCED') {
    throw new Error(`in ${method}: OpenPencil does not support the ${textCase} text case`)
  }
  return textCase
}

export function enumValue<T extends string>(
  method: string,
  value: unknown,
  allowed: ReadonlySet<T>,
  property = 'value'
): T {
  return parseFigma(v.picklist([...allowed]), value, method, property)
}
