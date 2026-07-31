import type PptxGenJS from 'pptxgenjs'

import type { Color, Fill, SceneNode, Stroke } from '@open-pencil/scene-graph'

import { colorToHex } from '#core/color'

/** Scene paint/effect/text style → PPT property mapping (no slide geometry). */

export function firstVisibleFill(node: SceneNode): Fill | null {
  return node.fills.find((f) => f.visible) ?? null
}

export function firstVisibleStroke(node: SceneNode): Stroke | null {
  return node.strokes.find((s) => s.visible) ?? null
}

export function isRounded(node: SceneNode): boolean {
  return effectiveRadius(node) > 0
}

export function hasAsymmetricCorners(node: SceneNode): boolean {
  if (!node.independentCorners) return false
  const radii = [
    node.topLeftRadius,
    node.topRightRadius,
    node.bottomRightRadius,
    node.bottomLeftRadius
  ]
  return radii.some((radius) => Math.abs(radius - radii[0]) > 1e-6)
}

export function effectiveRadius(node: SceneNode): number {
  return node.independentCorners ? node.topLeftRadius : node.cornerRadius
}

/** DROP_SHADOW without blur (design-system solid offset shadow) — drawn as a separate shape. */
export function getSolidOffsetShadow(node: SceneNode) {
  const e = node.effects.find((fx) => fx.visible && fx.type === 'DROP_SHADOW')
  if (!e) return null
  if (e.radius > 1) return null
  if (Math.abs(e.offset.x) < 0.5 && Math.abs(e.offset.y) < 0.5 && e.spread <= 0) return null
  return e
}

export function mapShadow(node: SceneNode, opacity: number): PptxGenJS.ShadowProps | undefined {
  const e = node.effects.find(
    (fx) => fx.visible && (fx.type === 'DROP_SHADOW' || fx.type === 'INNER_SHADOW')
  )
  if (!e) return undefined
  const angleRaw = (Math.atan2(e.offset.y, e.offset.x) * 180) / Math.PI
  return {
    type: e.type === 'INNER_SHADOW' ? 'inner' : 'outer',
    color: hex(e.color),
    opacity: clamp01(e.color.a * opacity),
    blur: Math.min(Math.max(e.radius, 0), 100),
    offset: Math.min(Math.hypot(e.offset.x, e.offset.y), 200),
    angle: angleRaw < 0 ? angleRaw + 360 : angleRaw
  }
}

export function mapHAlign(
  a: SceneNode['textAlignHorizontal']
): 'left' | 'center' | 'right' | 'justify' {
  if (a === 'CENTER') return 'center'
  if (a === 'RIGHT') return 'right'
  if (a === 'JUSTIFIED') return 'justify'
  return 'left'
}

export function mapVAlign(a: SceneNode['textAlignVertical']): 'top' | 'middle' | 'bottom' {
  if (a === 'CENTER') return 'middle'
  if (a === 'BOTTOM') return 'bottom'
  return 'top'
}

export function applyTextCase(text: string, textCase: SceneNode['textCase']): string {
  if (textCase === 'UPPER') return text.toUpperCase()
  if (textCase === 'LOWER') return text.toLowerCase()
  if (textCase === 'TITLE') return text.replace(/\b\w/g, (c) => c.toUpperCase())
  return text
}

export function hex(color: Color): string {
  return colorToHex(color).replace('#', '').slice(0, 6)
}

export function transparency(alpha: number): number {
  return Math.min(Math.max(Math.round((1 - clamp01(alpha)) * 100), 0), 100)
}

export function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1)
}

export function clampRot(deg: number): number {
  return Math.min(Math.max(deg, -360), 360)
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100
}
