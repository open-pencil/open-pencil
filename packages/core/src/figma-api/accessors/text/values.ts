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

import {
  invalid,
  invalidLiteral,
  invalidOption,
  noneMatched,
  numberProblem,
  received,
  tooBig,
  tooSmall,
  unrecognizedKeys
} from './messages'

// The values text setters take, checked as Figma checks them, with its messages.

export const DECORATIONS = new Set<TextDecoration>(['NONE', 'UNDERLINE', 'STRIKETHROUGH'])
export const DECORATION_STYLES = new Set<TextDecorationStyle>(['SOLID', 'DOTTED', 'WAVY'])
const LENGTH_UNITS = new Set(['PIXELS', 'PERCENT'])
const LENGTH_KEYS = new Set(['unit', 'value'])
const TEXT_CASES = new Set<TextCase>(['ORIGINAL', 'UPPER', 'LOWER', 'TITLE'])
/** Text cases Figma takes that OpenPencil cannot draw yet. */
const SMALL_CAPS = new Set(['SMALL_CAPS', 'SMALL_CAPS_FORCED'])
const SOLID_PAINT_KEYS = new Set([
  'type',
  'color',
  'opacity',
  'visible',
  'blendMode',
  'boundVariables'
])

function isLengthUnit(unit: unknown): unit is 'PIXELS' | 'PERCENT' {
  return typeof unit === 'string' && LENGTH_UNITS.has(unit)
}

/** A length in pixels for a font size: a percent is of the size of the characters it styles. */
export type SizedLength<T> = (fontSize: number) => T

/** `length` in pixels at the size of the characters it styles, for fields kept in pixels. */
export function sized(length: TextLength | null): SizedLength<number | null> {
  return (fontSize) => length && textLengthPixels(length, fontSize)
}

/** A font size Figma takes: a number of at least 1. */
export function fontSizeValue(method: string, value: unknown, property = 'value'): number {
  const problem = numberProblem(value) ?? ((value as number) < 1 ? tooSmall(1) : null)
  if (problem) throw invalid(method, problem, property)
  return value as number
}

/** A `{ unit, value }` length, its unit one of `units`; Figma knows no other keys. */
function length(
  method: string,
  value: unknown,
  property: string,
  unitProblem: (unit: unknown) => string | null
): TextLength {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalid(method, `Expected object, received ${received(value)}`, property)
  }
  const { unit, value: amount } = value as { unit?: unknown; value?: unknown }
  const problem =
    unitProblem(unit) ?? numberProblem(amount, ' at .value') ?? unrecognizedKeys(value, LENGTH_KEYS)
  if (problem) throw invalid(method, problem, property)
  return { unit: unit as TextLength['unit'], value: amount as number }
}

/** A letter spacing Figma takes: pixels or percent, never automatic. */
export function letterSpacingLength(
  method: string,
  value: unknown,
  property = 'value'
): TextLength {
  return length(method, value, property, (unit) =>
    isLengthUnit(unit) ? null : invalidOption(LENGTH_UNITS, ' at .unit')
  )
}

/** A length that may also be automatic, as line heights and decoration sizes are. */
export function lengthOrAuto(
  method: string,
  value: unknown,
  property = 'value'
): TextLength | null {
  if (value && typeof value === 'object' && (value as { unit?: unknown }).unit === 'AUTO') {
    const problem = unrecognizedKeys(value, new Set(['unit']))
    if (problem) throw invalid(method, problem, property)
    return null
  }
  return length(method, value, property, (unit) =>
    isLengthUnit(unit) ? null : 'Expected .unit to be one of the following: PIXELS, PERCENT, AUTO'
  )
}

export function stringProblem(value: unknown, at: string): string | null {
  return typeof value === 'string' ? null : `Expected string, received ${received(value)} at ${at}`
}

/** Variation settings Figma takes: numbers by axis tag. */
export function variationSettingsProblem(value: unknown): string | null {
  if (value === undefined) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return `Expected record, received ${received(value)} at .variationSettings`
  }
  for (const [tag, setting] of Object.entries(value)) {
    const problem = numberProblem(setting, ` at .variationSettings.${tag}`)
    if (problem) return problem
  }
  return null
}

/** A number from 0 to 1, as Figma takes colour channels and opacity. */
function unitProblem(value: unknown, at: string): string | null {
  const problem = numberProblem(value, ` at ${at}`)
  if (problem) return problem
  if ((value as number) < 0) return tooSmall(0, ` at ${at}`)
  if ((value as number) > 1) return tooBig(1, ` at ${at}`)
  return null
}

/** A solid paint's colour and opacity as Figma checks them; a colour's alpha may be left out. */
function solidPaintProblem(paint: { color?: unknown; opacity?: unknown }, at: string) {
  const { color, opacity } = paint
  const channels = color as Partial<Record<'r' | 'g' | 'b' | 'a', unknown>>
  for (const channel of ['r', 'g', 'b', 'a'] as const) {
    if (channel === 'a' && channels.a === undefined) continue
    const problem = unitProblem(channels[channel], `${at}.color.${channel}`)
    if (problem) return problem
  }
  return opacity === undefined ? null : unitProblem(opacity, `${at}.opacity`)
}

/** A range's fills, checked as `fills` checks them. */
export function fillsFromPaints(method: string, value: unknown): CharacterStyleOverride['fills'] {
  return parseFigmaPaints(value, method, 'value')
}

/**
 * A decoration colour Figma takes: `AUTO`, or a solid paint. A solid paint wrong only in its
 * values or its keys reports just that; any other input is reported against both choices.
 */
export function decorationColorFills(method: string, value: unknown): Fill[] {
  const color = (value as { value?: unknown } | null)?.value
  if (color === 'AUTO') return []
  const issues: string[] = []
  if (!color || typeof color !== 'object') {
    issues.push(`Expected object, received ${received(color)} at .value`)
  } else {
    const paint = color as Partial<Record<'type' | 'color', unknown>>
    if (paint.type !== 'SOLID') issues.push(invalidLiteral('SOLID', ' at .value.type'))
    if (paint.color === undefined) issues.push('Required value missing at .value.color')
    else if (!paint.color || typeof paint.color !== 'object') {
      issues.push(`Expected object, received ${received(paint.color)} at .value.color`)
    }
    const unknown = unrecognizedKeys(paint, SOLID_PAINT_KEYS, ' at .value')
    if (unknown && issues.length === 0) throw invalid(method, unknown, 'textDecorationColor')
    if (unknown) issues.push(unknown)
  }
  if (issues.length === 0) {
    const problem = solidPaintProblem(color as { color?: unknown; opacity?: unknown }, '.value')
    if (problem) throw invalid(method, problem, 'textDecorationColor')
    return parseFigmaPaints([color], method, 'textDecorationColor')
  }
  const paintProblem =
    issues.length === 1
      ? issues[0]
      : `Multiple issues:\n${issues.map((issue) => `    ${issue}`).join('\n')}`
  throw invalid(
    method,
    noneMatched([paintProblem, invalidLiteral('AUTO', ' at .value')]),
    'textDecorationColor'
  )
}

/** A text case Figma takes; it takes small caps too, which OpenPencil cannot draw yet. */
export function textCaseValue(method: string, value: unknown, property = 'value'): TextCase {
  if (SMALL_CAPS.has(value as string)) {
    throw new Error(`in ${method}: OpenPencil does not support the ${String(value)} text case`)
  }
  if (!TEXT_CASES.has(value as TextCase)) {
    throw invalid(method, invalidOption([...TEXT_CASES, ...SMALL_CAPS]), property)
  }
  return value as TextCase
}

export function enumValue<T extends string>(
  method: string,
  value: unknown,
  allowed: ReadonlySet<T>,
  property = 'value'
): T {
  if (!(allowed as ReadonlySet<unknown>).has(value)) {
    throw invalid(method, invalidOption(allowed), property)
  }
  return value as T
}
