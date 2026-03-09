import { parse, formatHex, formatHex8, formatRgb, converter, differenceEuclidean } from 'culori'

import { BLACK } from './constants'

import type { Color } from './types'

const toRgb = converter('rgb')

export function parseColor(input: string): Color {
  const parsed = parse(input)
  if (!parsed) return { ...BLACK }
  const rgb = toRgb(parsed)
  return {
    r: rgb.r,
    g: rgb.g,
    b: rgb.b,
    a: parsed.alpha ?? 1
  }
}

export function normalizeColor(color?: Partial<Color>): Color {
  if (!color) return { ...BLACK }
  return { r: color.r ?? 0, g: color.g ?? 0, b: color.b ?? 0, a: color.a ?? 1 }
}

export function colorToHex(color: Color): string {
  return formatHex({ mode: 'rgb', r: color.r, g: color.g, b: color.b }).toUpperCase()
}

export function colorToHex8(color: Color, alpha?: number): string {
  const a = alpha ?? color.a
  if (a >= 1) return colorToHex(color)
  return (
    formatHex8({ mode: 'rgb', r: color.r, g: color.g, b: color.b, alpha: a })
  ).toUpperCase()
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

const euclideanRgb255 = differenceEuclidean('rgb')

export function colorDistance(c1: Color, c2: Color): number {
  return euclideanRgb255(
    { mode: 'rgb', r: c1.r, g: c1.g, b: c1.b },
    { mode: 'rgb', r: c2.r, g: c2.g, b: c2.b }
  ) * 255
}
