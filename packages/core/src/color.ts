import { parse, formatHex, converter } from 'culori'

import { BLACK } from './constants'

import type { Color } from './types'

const toRgb = converter('rgb')

export function parseColor(input: string): Color {
  const parsed = parse(input)
  if (!parsed) return { ...BLACK }
  const rgb = toRgb(parsed)
  return {
    r: rgb?.r ?? 0,
    g: rgb?.g ?? 0,
    b: rgb?.b ?? 0,
    a: parsed.alpha ?? 1
  }
}

export function colorToHex(color: Color): string {
  return (formatHex({ mode: 'rgb', r: color.r, g: color.g, b: color.b }) ?? '#000000').toUpperCase()
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
  const { r, g, b } = colorToRgba255(color)
  return `rgb(${r}, ${g}, ${b})`
}

export function rgba255ToColor(rgba: Color): Color {
  return { r: rgba.r / 255, g: rgba.g / 255, b: rgba.b / 255, a: rgba.a }
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
