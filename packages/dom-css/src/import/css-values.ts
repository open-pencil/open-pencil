import type { Fill, Stroke } from '@open-pencil/scene-graph'
import { parseCSSColor, parseCSSNumber } from '@open-pencil/scene-graph/css'

import type { DesignStyleDeclaration } from '../types'

export function colorToFillFromCSS(value: string | undefined): Fill[] {
  const color = parseCSSColor(value)
  if (!color) return []
  return [{ type: 'SOLID', color, opacity: color.a, visible: true }]
}

export function colorToStrokeFromCSS(
  colorValue: string | undefined,
  weightValue: string | undefined
): Stroke[] {
  const color = parseCSSColor(colorValue)
  const weight = parseCSSNumber(weightValue)
  if (!color || weight === null || weight <= 0) return []
  return [{ type: 'SOLID', color, weight, opacity: color.a, visible: true, align: 'INSIDE' }]
}

export function pickStyle(elementStyle: DesignStyleDeclaration | undefined, property: string) {
  return elementStyle?.[property]
}

export function mergedStyle(node: {
  inlineStyle?: DesignStyleDeclaration
  computedStyle?: DesignStyleDeclaration
}) {
  return { ...node.inlineStyle, ...node.computedStyle }
}

function stripFontFamilyQuotes(value: string): string {
  if (value.length < 2) return value
  const first = value[0]
  const last = value[value.length - 1]
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) return value.slice(1, -1)
  return value
}

/** The first family of a CSS `font-family` list, without its quotes. */
export function firstFontFamily(value: string): string {
  const commaIndex = value.indexOf(',')
  const raw = commaIndex !== -1 ? value.slice(0, commaIndex) : value
  return stripFontFamilyQuotes(raw.trim())
}
