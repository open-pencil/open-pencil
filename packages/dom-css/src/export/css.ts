import type { Effect, Fill, Stroke, TextLength } from '@open-pencil/scene-graph'
import { colorToCSS, colorToHex } from '@open-pencil/scene-graph/color'
import { gradientPoint } from '@open-pencil/scene-graph/gradient'
import type { Color } from '@open-pencil/scene-graph/primitives'

import type { DesignStyleDeclaration } from '../types'

/** Opaque colors as hex, which Tailwind matches to its palette; translucent ones as `rgba()`. */
export function cssColor(color: Color): string {
  return color.a >= 1 ? colorToHex(color) : colorToCSS(color)
}

export function fillToCSS(fill: Fill | undefined): string | undefined {
  if (fill?.type !== 'SOLID' || !fill.visible) return undefined
  return cssColor({ ...fill.color, a: fill.opacity })
}

export function strokeColorToCSS(stroke: Stroke | undefined): string | undefined {
  if (!stroke?.visible) return undefined
  return cssColor({ ...stroke.color, a: stroke.opacity })
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

/** A line height as CSS writes it: a percent as the unitless multiple that follows the font size. */
export function lineHeightToCSS(length: TextLength): string {
  return length.unit === 'PIXELS' ? `${length.value}px` : String(length.value / 100)
}

/** A letter spacing as CSS writes it: a percent of the font size in `em`. */
export function letterSpacingToCSS(length: TextLength): string {
  return length.unit === 'PIXELS' ? `${length.value}px` : `${length.value / 100}em`
}

/** A share of the layer's box as a CSS percentage. */
function percent(value: number): string {
  return `${Number((value * 100).toFixed(3))}%`
}

function gradientStopsCSS(fill: Fill): string {
  return (fill.gradientStops ?? [])
    .map(
      (stop) =>
        `${cssColor({ ...stop.color, a: stop.color.a * fill.opacity })} ${percent(stop.position)}`
    )
    .join(', ')
}

/**
 * The CSS angle of a linear or angular gradient across a `width` by `height` box: 0deg points
 * up and 90deg right, measured from where the gradient starts to where it ends.
 */
function gradientAngle(fill: Fill, width: number, height: number): number {
  const t = fill.gradientTransform
  if (!t) return 90
  const start = gradientPoint(t, { x: 0, y: 0.5 })
  const end = gradientPoint(t, { x: 1, y: 0.5 })
  const degrees =
    (Math.atan2((end.x - start.x) * width, -(end.y - start.y) * height) * 180) / Math.PI
  return Number((((degrees % 360) + 360) % 360).toFixed(3))
}

/** A gradient fill as a CSS image over a `width` by `height` box, or undefined for a diamond. */
export function gradientToCSS(fill: Fill, width: number, height: number): string | undefined {
  const t = fill.gradientTransform ?? { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
  const center = gradientPoint(t, { x: 0.5, y: 0.5 })
  if (fill.type === 'GRADIENT_LINEAR') {
    return `linear-gradient(${gradientAngle(fill, width, height)}deg, ${gradientStopsCSS(fill)})`
  }
  if (fill.type === 'GRADIENT_RADIAL') {
    const right = gradientPoint(t, { x: 1, y: 0.5 })
    const bottom = gradientPoint(t, { x: 0.5, y: 1 })
    const rx = Math.hypot(right.x - center.x, right.y - center.y)
    const ry = Math.hypot(bottom.x - center.x, bottom.y - center.y)
    const shape = `${percent(rx)} ${percent(ry)} at ${percent(center.x)} ${percent(center.y)}`
    return `radial-gradient(${shape}, ${gradientStopsCSS(fill)})`
  }
  if (fill.type === 'GRADIENT_ANGULAR') {
    const from = gradientAngle(fill, width, height)
    const at = `${percent(center.x)} ${percent(center.y)}`
    return `conic-gradient(from ${from}deg at ${at}, ${gradientStopsCSS(fill)})`
  }
  return undefined
}
