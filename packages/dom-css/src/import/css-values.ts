import valueParser, { type ParsedNode } from 'postcss-value-parser'

import type { Effect, Fill, Stroke } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

import type { DesignStyleDeclaration } from '../types'

const TRANSPARENT_KEYWORDS = new Set(['transparent', 'rgba(0, 0, 0, 0)', 'rgb(0 0 0 / 0)'])

export function parseCSSNumber(value: string | undefined): number | null {
  if (!value) return null
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed === 'auto') return null
  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed)) return null
  return trimmed.endsWith('rem') ? parsed * 16 : parsed
}

export function parseCSSColor(value: string | undefined): Color | null {
  if (!value) return null
  const trimmed = value.trim()
  if (trimmed.length === 0 || TRANSPARENT_KEYWORDS.has(trimmed.toLowerCase())) return null
  return parseColor(trimmed)
}

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

function firstShadowLayerNodes(value: string): ParsedNode[] {
  const nodes: ParsedNode[] = []
  for (const node of valueParser(value).nodes) {
    if (node.type === 'div' && node.value === ',') return nodes
    nodes.push(node)
  }
  return nodes
}

function shadowColorFromNodes(nodes: ParsedNode[]): Color | null {
  for (const node of nodes) {
    if (node.type === 'function') {
      const color = parseCSSColor(valueParser.stringify(node))
      if (color) return color
      continue
    }

    if (node.type !== 'word') continue
    const color = parseCSSColor(node.value)
    if (color) return color
  }
  return null
}

function shadowNumbersFromNodes(nodes: ParsedNode[]): number[] {
  return nodes
    .filter((node) => node.type === 'word' && valueParser.unit(node.value) !== false)
    .map((node) => parseCSSNumber(node.value))
    .filter((number): number is number => number !== null)
}

export function dropShadowFromCSS(value: string | undefined): Effect[] {
  if (!value || value.trim() === 'none') return []

  const nodes = firstShadowLayerNodes(value)
  if (nodes.some((node) => node.type === 'word' && node.value === 'inset')) return []

  const color = shadowColorFromNodes(nodes)
  if (!color) return []

  const [offsetX = 0, offsetY = 0, radius = 0, spread = 0] = shadowNumbersFromNodes(nodes)

  return [
    {
      type: 'DROP_SHADOW',
      color,
      offset: { x: offsetX, y: offsetY },
      radius,
      spread,
      visible: true,
      blendMode: 'NORMAL'
    }
  ]
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
