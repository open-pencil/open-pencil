import type { SceneNode, Stroke } from '@open-pencil/scene-graph'
import type { Color, JsonObject } from '@open-pencil/scene-graph/primitives'

import { parseColor } from '#core/color'

export const WEIGHT_MAP: Record<string, number> = {
  normal: 400,
  medium: 500,
  bold: 700
}

export const ALIGN_MAP: Record<string, SceneNode['primaryAxisAlign']> = {
  start: 'MIN',
  end: 'MAX',
  center: 'CENTER',
  between: 'SPACE_BETWEEN'
}

export const COUNTER_ALIGN_MAP: Record<string, 'MIN' | 'MAX' | 'CENTER' | 'STRETCH'> = {
  start: 'MIN',
  end: 'MAX',
  center: 'CENTER',
  stretch: 'STRETCH'
}

export const TEXT_ALIGN_MAP: Record<string, SceneNode['textAlignHorizontal']> = {
  left: 'LEFT',
  center: 'CENTER',
  right: 'RIGHT',
  justified: 'JUSTIFIED'
}

export const TEXT_VERTICAL_ALIGN_MAP: Record<string, SceneNode['textAlignVertical']> = {
  top: 'TOP',
  center: 'CENTER',
  bottom: 'BOTTOM'
}

export const TEXT_ALIGN_ALIAS_MAP: Record<string, SceneNode['textAlignHorizontal']> = {
  ...TEXT_ALIGN_MAP,
  left_align: 'LEFT',
  center_align: 'CENTER',
  right_align: 'RIGHT'
}

export const TEXT_AUTO_RESIZE_MAP: Record<string, SceneNode['textAutoResize']> = {
  none: 'NONE',
  width: 'WIDTH_AND_HEIGHT',
  height: 'HEIGHT'
}

export const DIRECTION_MAP: Record<string, SceneNode['textDirection']> = {
  auto: 'AUTO',
  ltr: 'LTR',
  rtl: 'RTL'
}

export function parseDirection(value: unknown): SceneNode['textDirection'] | undefined {
  if (typeof value !== 'string') return undefined
  return DIRECTION_MAP[value.toLowerCase()] ?? 'AUTO'
}

export function parseStroke(value: string | Color, width: number): Stroke {
  const color = typeof value === 'string' ? parseColor(value) : value
  return {
    color,
    opacity: color.a,
    visible: true,
    weight: width,
    align: 'INSIDE'
  }
}

export function numberFromPx(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed.endsWith('px')) return undefined
  const parsed = Number.parseFloat(trimmed.slice(0, -2))
  return Number.isFinite(parsed) ? parsed : undefined
}

export function normalizeStyleProps(props: Record<string, unknown>): Record<string, unknown> {
  const style = props.style
  if (style === null || typeof style !== 'object' || Array.isArray(style)) return props

  const source = style as JsonObject
  const normalized = { ...props }
  const copyIfUnset = (from: string, to: string, convert?: (value: unknown) => unknown): void => {
    if (normalized[to] !== undefined || source[from] === undefined) return
    normalized[to] = convert ? convert(source[from]) : source[from]
  }

  copyIfUnset('background', 'bg')
  copyIfUnset('backgroundColor', 'bg')
  copyIfUnset('color', 'color')
  copyIfUnset('borderColor', 'stroke')
  copyIfUnset('borderWidth', 'strokeWidth', numberFromPx)
  copyIfUnset('borderRadius', 'rounded', numberFromPx)
  copyIfUnset('fontSize', 'fontSize', numberFromPx)
  copyIfUnset('fontWeight', 'fontWeight')
  copyIfUnset('width', 'width', numberFromPx)
  copyIfUnset('height', 'height', numberFromPx)
  copyIfUnset('opacity', 'opacity')
  return normalized
}
