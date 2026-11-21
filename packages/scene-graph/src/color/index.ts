export * from './contrast'
export * from './management'
export { normalizeColor } from './normalize'
export { colorProfileSchema, EXPORT_COLOR_PROFILE_NAMES, exportColorProfileSchema } from './schema'
export * from './okhcl'

import { formatHex, formatHex8, formatRgb, differenceEuclidean } from 'culori'

import type { Color } from '../primitives'
import type { ColorProfile } from '../types'
import { convertColor, parseColor } from './management'

export function colorToHex(color: Color): string {
  return formatHex({ mode: 'rgb', r: color.r, g: color.g, b: color.b }).toUpperCase()
}

/**
 * `color`, whose components are in `profile`, as the sRGB hex code tools display: hex holds sRGB
 * only, so a color outside it is brought inside by reducing chroma, not clipped.
 */
export function colorToSRGBHex(color: Color, profile: ColorProfile): string {
  return colorToHex(convertColor(color, profile, 'srgb', 'map'))
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

/** A solid paint of `color`, a CSS color read into `profile` or components already in it. */
export function colorToFill(color: string | Color, profile: ColorProfile = 'srgb') {
  const rgba = typeof color === 'string' ? parseColor(color, profile) : color
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
