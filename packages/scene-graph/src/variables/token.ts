import type { TokenUnit } from '../types'

/** `rem` tokens are stored in canvas pixels and shown against this root font size. */
export const ROOT_FONT_SIZE_PX = 16

/** The stored number for a value typed in a unit: `1.5` in `rem` is 24 canvas pixels. */
export function tokenNumberFromUnit(value: number, unit: TokenUnit): number {
  return unit === 'rem' ? value * ROOT_FONT_SIZE_PX : value
}

/** A stored number as it reads in its unit: 24 canvas pixels in `rem` is `1.5`. */
export function tokenNumberInUnit(value: number, unit: TokenUnit): number {
  return unit === 'rem' ? value / ROOT_FONT_SIZE_PX : value
}
