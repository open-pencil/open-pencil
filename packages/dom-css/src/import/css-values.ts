import type { Fill, Stroke } from '@open-pencil/scene-graph'
import { tryParseColor } from '@open-pencil/scene-graph/color'
import { parseCSSColor, parseCSSNumber } from '@open-pencil/scene-graph/css'
import type { Color } from '@open-pencil/scene-graph/primitives'

import type { DesignStyleDeclaration } from '../types'

export function colorToFillFromCSS(value: string | undefined): Fill[] {
  const color = parseCSSColor(value)
  if (!color) return []
  return [{ type: 'SOLID', color, opacity: color.a, visible: true }]
}

/** A CSS color, a fully transparent one included, which draws nothing and so is no paint. */
export function anyCSSColor(value: string | undefined): Color | null {
  return parseCSSColor(value) ?? (value ? tryParseColor(value) : null)
}

export function colorToStrokeFromCSS(
  colorValue: string | undefined,
  weightValue: string | undefined,
  keepTransparent = false
): Stroke[] {
  const color = keepTransparent ? anyCSSColor(colorValue) : parseCSSColor(colorValue)
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
