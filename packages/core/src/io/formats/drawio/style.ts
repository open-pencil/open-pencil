import type { Color } from '@open-pencil/scene-graph'
import { tryParseColor } from '@open-pencil/scene-graph/color'

/** A draw.io `style` string: `key=value` pairs, plus bare words such as `ellipse` or `rhombus`. */
export type DrawioStyle = Partial<Record<string, string>>

export function parseStyle(style: string): DrawioStyle {
  const result: DrawioStyle = {}
  for (const part of style.split(';')) {
    const text = part.trim()
    if (!text) continue
    const eq = text.indexOf('=')
    if (eq === -1) result[text] = '1'
    else result[text.slice(0, eq)] = text.slice(eq + 1)
  }
  return result
}

export function styleNumber(style: DrawioStyle, key: string, fallback: number): number {
  const value = Number.parseFloat(style[key] ?? '')
  return Number.isFinite(value) ? value : fallback
}

/** A colour, or null for `none`, `default` and anything that is not a CSS colour. */
export function styleColor(style: DrawioStyle, key: string): Color | null {
  const value = style[key]
  if (!value || value === 'none' || value === 'default' || value === 'inherit') return null
  return tryParseColor(value)
}
