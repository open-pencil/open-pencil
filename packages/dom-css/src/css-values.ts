import valueParser, { type ParsedNode } from 'postcss-value-parser'

import type { Effect, Fill, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { colorToCSS, colorToHex, parseColor } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

import type { DesignStyleDeclaration } from './types'

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

/** Opaque colors as hex, which Tailwind matches to its palette; translucent ones as `rgba()`. */
export function cssColor(color: Color): string {
  return color.a >= 1 ? colorToHex(color) : colorToCSS(color)
}

export function fillToCSS(fill: Fill | undefined): string | undefined {
  if (fill?.type !== 'SOLID' || !fill.visible) return undefined
  return cssColor({ ...fill.color, a: fill.opacity })
}

export function colorToFillFromCSS(value: string | undefined): Fill[] {
  const color = parseCSSColor(value)
  if (!color) return []
  return [{ type: 'SOLID', color, opacity: color.a, visible: true }]
}

export function strokeColorToCSS(stroke: Stroke | undefined): string | undefined {
  if (!stroke?.visible) return undefined
  return cssColor({ ...stroke.color, a: stroke.opacity })
}

export function strokeToCSS(stroke: Stroke | undefined): string | undefined {
  const color = strokeColorToCSS(stroke)
  if (!color || !stroke) return undefined
  return `${stroke.weight}px solid ${color}`
}

export function colorToStrokeFromCSS(
  colorValue: string | undefined,
  weightValue: string | undefined
): Stroke[] {
  const color = parseCSSColor(colorValue)
  const weight = parseCSSNumber(weightValue)
  if (!color || weight === null || weight <= 0) return []
  return [{ color, weight, opacity: color.a, visible: true, align: 'INSIDE' }]
}

function shadowToCSS(effect: Effect): string {
  const inset = effect.type === 'INNER_SHADOW' ? 'inset ' : ''
  return `${inset}${effect.offset.x}px ${effect.offset.y}px ${effect.radius}px ${effect.spread}px ${cssColor(effect.color)}`
}

export function dropShadowToCSS(effect: Effect | undefined): string | undefined {
  if (effect?.type !== 'DROP_SHADOW' || !effect.visible) return undefined
  return shadowToCSS(effect)
}

/** Every visible shadow, in order, plus layer and background blur. */
export function effectsToCSS(effects: Effect[]): DesignStyleDeclaration {
  const style: DesignStyleDeclaration = {}
  const visible = effects.filter((effect) => effect.visible)
  const shadows = visible.filter(
    (effect) => effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW'
  )
  if (shadows.length > 0) style['box-shadow'] = shadows.map(shadowToCSS).join(', ')
  for (const effect of visible) {
    if (effect.type === 'LAYER_BLUR' || effect.type === 'FOREGROUND_BLUR')
      style.filter = `blur(${effect.radius}px)`
    if (effect.type === 'BACKGROUND_BLUR') style['backdrop-filter'] = `blur(${effect.radius}px)`
  }
  return style
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

export function sceneNodeSizeStyle(node: SceneNode): DesignStyleDeclaration {
  const style: DesignStyleDeclaration = {}
  if (node.width > 0) style.width = `${node.width}px`
  if (node.height > 0) style.height = `${node.height}px`
  return style
}
