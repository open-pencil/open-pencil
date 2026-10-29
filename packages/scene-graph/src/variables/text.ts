import type { VariableValue } from '../types'

/**
 * The text a variable bound to text content shows: a string as it is, and a number or boolean
 * as Figma writes it, since Figma lets either be text content. A formula's `text()` and a `+`
 * that joins text write numbers the same way.
 */
export function variableText(value: VariableValue | undefined): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'number' && Number.isFinite(value)) return numberText(value)
  return undefined
}

const INT32_MIN = -2_147_483_648
const INT32_MAX = 2_147_483_647

/** How near zero a value must be for Figma to write it as 0. */
const ZERO_TOLERANCE = 1e-6

/**
 * A number as Figma writes it as text, read at the 32-bit precision Figma stores: within a
 * millionth of zero as 0, a whole number as that integer clamped to 32 bits, and anything else
 * with two decimals, its sign kept and an exact tie rounded to even, as C's `%.2f` does (0.125
 * is "0.12", 0.999 is "1.00", -0.004 is "-0.00", 2.0000002 is "2.00").
 */
function numberText(input: number): string {
  const value = Math.fround(input)
  if (Math.abs(value) < ZERO_TOLERANCE) return '0'
  if (Number.isInteger(value)) return String(Math.min(INT32_MAX, Math.max(INT32_MIN, value)))
  const scaled = Math.abs(value) * 100
  const floor = Math.floor(scaled)
  const tie = scaled - floor === 0.5
  const cents = tie ? floor + (floor % 2) : Math.round(scaled)
  const sign = value < 0 ? '-' : ''
  return `${sign}${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

/** Text Figma reads as false besides the empty string, ignoring case and surrounding spaces. */
const FALSE_WORDS = new Set(['false', 'no', 'off'])

/**
 * Whether Figma reads a value as true, as a formula's `truthy()` and a visibility binding do: a
 * number other than 0, and text other than "", "false", "no" or "off".
 */
export function variableTruthy(value: VariableValue | undefined): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') return value !== '' && !FALSE_WORDS.has(value.trim().toLowerCase())
  return undefined
}
