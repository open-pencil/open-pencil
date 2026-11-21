import { converter, formatCss, formatRgb, inGamut, parse, toGamut } from 'culori'

import type { Color } from '../primitives'
import type { ColorProfile } from '../types'
import { normalizeColor } from './normalize'

const toRGB = converter('rgb')
const toP3 = converter('p3')
const toLinearSRGB = converter('lrgb')
const toDisplayableRGB = toGamut('rgb', 'oklch')
const toDisplayableP3 = toGamut('p3', 'oklch')
const isDisplayableRGB = inGamut('rgb')

/**
 * How far past 0 or 1 a component may land and still count as inside a gamut. Conversions round
 * off: P3 red read through OKLCH comes back with a blue of -1e-15, which is the same color.
 */
const GAMUT_TOLERANCE = 1e-6

type CuloriColor = { mode: 'rgb' | 'p3'; r: number; g: number; b: number; alpha?: number }

function culoriColor(color: Color, profile: ColorProfile): CuloriColor {
  const mode = profile === 'display-p3' ? 'p3' : 'rgb'
  return { mode, r: color.r, g: color.g, b: color.b, alpha: color.a }
}

function sceneColor(
  color: { r: number; g: number; b: number; alpha?: number },
  alpha: number
): Color {
  return { r: color.r, g: color.g, b: color.b, a: color.alpha ?? alpha }
}

/** Whether `color`'s components fit 0 to 1, give or take round-off. */
export function fitsGamut(color: Pick<Color, 'r' | 'g' | 'b'>): boolean {
  return [color.r, color.g, color.b].every(
    (channel) => channel >= -GAMUT_TOLERANCE && channel <= 1 + GAMUT_TOLERANCE
  )
}

function clampToGamut(color: Color): Color {
  const clamp = (channel: number) => Math.min(1, Math.max(0, channel))
  return { r: clamp(color.r), g: clamp(color.g), b: clamp(color.b), a: color.a }
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
  const converted = sceneColor(to === 'display-p3' ? toP3(source) : toRGB(source), color.a)
  if (gamut === 'extend') return converted
  if (fitsGamut(converted)) return clampToGamut(converted)
  const mapped =
    to === 'display-p3' ? toP3(toDisplayableP3(source)) : toRGB(toDisplayableRGB(source))
  return normalizeColor(sceneColor(mapped, color.a))
}

/**
 * `color`, whose components are in `profile`, as the sRGB components of the same color: past 0 and
 * 1 where it lies outside sRGB. Skia takes colors this way and converts them into the space of
 * whatever it draws on, so a wide-gamut color reaches it whole.
 */
export function toExtendedSRGB(color: Color, profile: ColorProfile): Color {
  return convertColor(color, profile, 'srgb')
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

/**
 * A CSS color in any space, mapped into sRGB the way CSS maps out-of-gamut colors: by reducing
 * chroma in OKLCH, so a Display P3 red becomes the nearest sRGB red, not a clipped one. A missing
 * (`none`) component reads as zero. Null when `input` is not a color.
 */
export function parseDisplayableColor(input: string): Color | null {
  const parsed = parse(input)
  if (!parsed) return null
  // Mapping through OKLCH shifts colors already in sRGB by float noise, so only map the rest.
  const rgb = isDisplayableRGB(parsed) ? toRGB(parsed) : toDisplayableRGB(parsed)
  // culori leaves a `none` channel out, which normalizing reads as zero.
  return normalizeColor({ r: rgb.r, g: rgb.g, b: rgb.b, a: parsed.alpha })
}
