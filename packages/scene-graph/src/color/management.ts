import { converter, formatCss, formatRgb, parse, toGamut, type Color as CuloriColor } from 'culori'

import { BLACK } from '../constants'
import type { Color } from '../primitives'
import type { ColorProfile } from '../types'
import { normalizeColor } from './normalize'

const toLinearSRGB = converter('lrgb')
const toRGB = converter('rgb')
const toP3 = converter('p3')
const toDisplayableRGB = toGamut('rgb', 'oklch')
const toDisplayableP3 = toGamut('p3', 'oklch')

/**
 * How far past 0 or 1 a component may land and still count as inside a gamut. Conversions round
 * off: P3 red read through OKLCH comes back with a blue of -1e-15, which is the same color.
 */
const GAMUT_TOLERANCE = 1e-6

/** Whether `color`'s components fit 0 to 1, give or take round-off. */
export function fitsGamut(color: Pick<Color, 'r' | 'g' | 'b'>): boolean {
  return [color.r, color.g, color.b].every(
    (channel) => channel >= -GAMUT_TOLERANCE && channel <= 1 + GAMUT_TOLERANCE
  )
}

/** `color`, a culori color in any space, as components in `profile`, past 0 and 1 if need be. */
function exactlyInProfile(color: CuloriColor, profile: ColorProfile): Color {
  const { r, g, b } = profile === 'display-p3' ? toP3(color) : toRGB(color)
  return { r, g, b, a: color.alpha ?? 1 }
}

/**
 * `color`, a culori color in any space, as components in `profile`, brought inside it the way CSS
 * maps out-of-gamut colors, by reducing chroma in OKLCH so lightness and hue hold, and whether it
 * had to be. A color inside already keeps its components, as mapping it would shift them by float
 * noise; one on the gamut's edge, as every saturated primary is, counts as inside despite
 * round-off. A missing (`none`) component reads as zero.
 */
export function fitIntoProfile(
  color: CuloriColor,
  profile: ColorProfile
): { color: Color; clipped: boolean } {
  const exact = normalizeColor(exactlyInProfile(color, profile))
  const clipped = !fitsGamut(exact)
  const p3 = profile === 'display-p3'
  const inside = clipped
    ? normalizeColor(
        exactlyInProfile(p3 ? toDisplayableP3(color) : toDisplayableRGB(color), profile)
      )
    : exact
  const clamp = (channel: number) => Math.min(1, Math.max(0, channel))
  return {
    color: { r: clamp(inside.r), g: clamp(inside.g), b: clamp(inside.b), a: color.alpha ?? 1 },
    clipped
  }
}

function insideProfile(color: CuloriColor, profile: ColorProfile): Color {
  return fitIntoProfile(color, profile).color
}

function culoriColor(color: Color, profile: ColorProfile): CuloriColor {
  const mode = profile === 'display-p3' ? 'p3' : 'rgb'
  return { mode, r: color.r, g: color.g, b: color.b, alpha: color.a }
}

/**
 * What to do with a color the target profile cannot show: `extend` keeps its components past 0
 * and 1, for a renderer such as Skia that takes extended sRGB; `map` brings it inside by reducing
 * chroma in OKLCH, as CSS maps out-of-gamut colors, keeping its lightness and hue.
 */
export type GamutHandling = 'extend' | 'map'

/** `color`, whose components are in `from`, as the components in `to` that show the same color. */
export function convertColor(
  color: Color,
  from: ColorProfile,
  to: ColorProfile,
  gamut: GamutHandling = 'extend'
): Color {
  if (from === to) return color
  const source = culoriColor(color, from)
  return gamut === 'extend' ? exactlyInProfile(source, to) : insideProfile(source, to)
}

/**
 * `color`, whose components are in `profile`, as the sRGB components of the same color: past 0 and
 * 1 where it lies outside sRGB. Skia takes colors this way and converts them into the space of
 * whatever it draws on, so a wide-gamut color reaches it whole.
 */
export function toExtendedSRGB(color: Color, profile: ColorProfile): Color {
  if (profile === 'srgb') return color
  // Renderers call this for every paint they draw, so it skips culori's color objects: Display P3
  // shares sRGB's transfer curve, leaving one matrix between the linear components.
  // Indexed reads of a plain array: destructuring costs more than the conversion.
  const m = P3_TO_LINEAR_SRGB
  const r = decodeSRGB(color.r)
  const g = decodeSRGB(color.g)
  const b = decodeSRGB(color.b)
  return {
    r: encodeSRGB(m[0] * r + m[1] * g + m[2] * b),
    g: encodeSRGB(m[3] * r + m[4] * g + m[5] * b),
    b: encodeSRGB(m[6] * r + m[7] * g + m[8] * b),
    a: color.a
  }
}

/** The sRGB transfer curve, mirrored below zero as extended sRGB and culori's `lrgb` take it. */
function decodeSRGB(channel: number): number {
  const magnitude = Math.abs(channel)
  if (magnitude <= 0.04045) return channel / 12.92
  return (Math.sign(channel) || 1) * ((magnitude + 0.055) / 1.055) ** 2.4
}

function encodeSRGB(channel: number): number {
  const magnitude = Math.abs(channel)
  if (magnitude <= 0.0031308) return channel * 12.92
  return (Math.sign(channel) || 1) * (1.055 * magnitude ** (1 / 2.4) - 0.055)
}

/**
 * `color`, whose components are in `from`, as CSS showing it in `to`: `color(display-p3 …)` for
 * Display P3, `rgb()` for sRGB, where a color outside sRGB clips per channel as a canvas clips it.
 */
export function colorToProfileCSS(color: Color, from: ColorProfile, to: ColorProfile): string {
  const shown = convertColor(color, from, to)
  if (to === 'display-p3') {
    return formatCss({ mode: 'p3', r: shown.r, g: shown.g, b: shown.b, alpha: shown.a })
  }
  return formatRgb({ mode: 'rgb', r: shown.r, g: shown.g, b: shown.b, alpha: shown.a })
}

/**
 * The 3×3 matrix, row by row, taking linear components in `profile` to linear sRGB ones: its
 * columns are the profile's primaries in linear sRGB.
 */
export function linearSRGBMatrix(profile: ColorProfile): number[] {
  const mode = profile === 'display-p3' ? 'p3' : 'rgb'
  const columns = [
    { r: 1, g: 0, b: 0 },
    { r: 0, g: 1, b: 0 },
    { r: 0, g: 0, b: 1 }
  ].map((primary) => toLinearSRGB({ mode, ...primary }))
  return (['r', 'g', 'b'] as const).flatMap((row) => columns.map((column) => column[row]))
}

/** Display P3's matrix, made once: renderers convert every paint they draw through it. */
const P3_TO_LINEAR_SRGB = linearSRGBMatrix('display-p3')

/**
 * A CSS color in any space, mapped into sRGB the way CSS maps out-of-gamut colors: by reducing
 * chroma in OKLCH, so a Display P3 red becomes the nearest sRGB red, not a clipped one. A missing
 * (`none`) component reads as zero. Null when `input` is not a color.
 */
export function parseDisplayableColor(input: string): Color | null {
  const parsed = parse(input)
  return parsed ? insideProfile(parsed, 'srgb') : null
}

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
  return insideProfile(parsed, profile)
}

/** A CSS color as components in `profile`, or black when `input` is not one. */
export function parseColor(input: string, profile: ColorProfile = 'srgb'): Color {
  return tryParseColor(input, profile) ?? { ...BLACK }
}
