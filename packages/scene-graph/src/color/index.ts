export * from './contrast'
export * from './management'
export { normalizeColor } from './normalize'
export * from './okhcl'

import {
  parse,
  formatHex,
  formatHex8,
  formatRgb,
  converter,
  differenceEuclidean,
  toGamut
} from 'culori'

import { BLACK } from '../constants'
import type { Color } from '../primitives'
import type { ColorProfile } from '../types'
import { fitsGamut } from './management'
import { normalizeColor } from './normalize'

const toRGB = converter('rgb')
const toP3 = converter('p3')
const toDisplayableRGB = toGamut('rgb', 'oklch')
const toDisplayableP3 = toGamut('p3', 'oklch')

/** Syntaxes CSS reads as sRGB numbers: hex, `rgb()`, `hsl()`, `hwb()`, names, `color(srgb …)`. */
const SRGB_SYNTAX_MODES = new Set(['rgb', 'hsl', 'hwb'])

/**
 * A CSS color as components in `profile`, or null when `input` is not one. Hex and the other sRGB
 * syntaxes give their numbers as they are, as Figma takes typed or imported hex as the document's
 * own numbers in either profile. A color that names its space, such as `color(display-p3 …)` or
 * `oklch()`, is converted into `profile`, and brought inside it by reducing chroma when the
 * profile cannot show it.
 */
export function tryParseColor(input: string, profile: ColorProfile = 'srgb'): Color | null {
  const parsed = parse(input)
  if (!parsed) return null
  const a = parsed.alpha ?? 1
  // culori leaves a `none` channel out, which normalizing reads as zero.
  if (SRGB_SYNTAX_MODES.has(parsed.mode)) return normalizeColor({ ...toRGB(parsed), a })
  const p3 = profile === 'display-p3'
  const exact = p3 ? toP3(parsed) : toRGB(parsed)
  const mapped = () => (p3 ? toP3(toDisplayableP3(parsed)) : toRGB(toDisplayableRGB(parsed)))
  const inside = fitsGamut(exact) ? exact : mapped()
  const { r, g, b } = normalizeColor(inside)
  const clamp = (channel: number) => Math.min(1, Math.max(0, channel))
  return { r: clamp(r), g: clamp(g), b: clamp(b), a }
}

/** A CSS color as components in `profile`, or black when `input` is not one. */
export function parseColor(input: string, profile: ColorProfile = 'srgb'): Color {
  return tryParseColor(input, profile) ?? { ...BLACK }
}

export function colorToHex(color: Color): string {
  return formatHex({ mode: 'rgb', r: color.r, g: color.g, b: color.b }).toUpperCase()
}

export function colorToHex8(color: Color, alpha?: number): string {
  const a = alpha ?? color.a
  if (a >= 1) return colorToHex(color)
  return formatHex8({ mode: 'rgb', r: color.r, g: color.g, b: color.b, alpha: a }).toUpperCase()
}

export function colorToHexRaw(color: Color): string {
  return colorToHex(color).slice(1)
}

export function colorToRgba255(color: Color) {
  return {
    r: Math.round(color.r * 255),
    g: Math.round(color.g * 255),
    b: Math.round(color.b * 255),
    a: color.a
  }
}

export function colorToCSS(color: Color): string {
  return formatRgb({ mode: 'rgb', r: color.r, g: color.g, b: color.b, alpha: color.a })
}

export function colorToCSSCompact(color: Color): string {
  const { r, g, b } = colorToRgba255(color)
  const a = Number(color.a.toFixed(3))
  if (a >= 1) return `rgb(${r},${g},${b})`
  return `rgba(${r},${g},${b},${a})`
}

export function rgba255ToColor(r: number, g: number, b: number, a = 1): Color {
  return { r: r / 255, g: g / 255, b: b / 255, a }
}

export function colorToFill(color: string | Color) {
  const rgba = typeof color === 'string' ? parseColor(color) : color
  return {
    type: 'SOLID' as const,
    color: { r: rgba.r, g: rgba.g, b: rgba.b, a: rgba.a },
    opacity: rgba.a,
    visible: true
  }
}

const euclideanRGB255 = differenceEuclidean('rgb')

export function colorDistance(c1: Color, c2: Color): number {
  return (
    euclideanRGB255(
      { mode: 'rgb', r: c1.r, g: c1.g, b: c1.b },
      { mode: 'rgb', r: c2.r, g: c2.g, b: c2.b }
    ) * 255
  )
}
export * from './schema'
