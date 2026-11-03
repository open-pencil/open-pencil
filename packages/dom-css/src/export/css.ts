import type { Effect, Fill, Stroke, TextLength } from '@open-pencil/scene-graph'
import { colorToCSS, colorToHex } from '@open-pencil/scene-graph/color'
import { blurSigma } from '@open-pencil/scene-graph/geometry'
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

function px(value: number): string {
  return `${Number(value.toFixed(3))}px`
}

/**
 * A shadow as `box-shadow` writes it, or as `text-shadow` does without its spread. CSS blurs a
 * shadow by half its blur length, so the length is twice the sigma the canvas blurs it by.
 */
function shadowToCSS(effect: Effect, spread = true): string {
  const inset = effect.type === 'INNER_SHADOW' ? 'inset ' : ''
  const lengths = [effect.offset.x, effect.offset.y, 2 * blurSigma(effect.radius)]
  if (spread) lengths.push(effect.spread)
  return `${inset}${lengths.map(px).join(' ')} ${cssColor(effect.color)}`
}

/** A blur as CSS's `blur()` takes it: the sigma itself, as the canvas blurs by. */
function blurToCSS(effect: Effect): string {
  return `blur(${px(blurSigma(effect.radius))})`
}

/** Every visible shadow, in order, plus layer and background blur. */
export function effectsToCSS(effects: Effect[]): DesignStyleDeclaration {
  const style: DesignStyleDeclaration = {}
  const visible = effects.filter((effect) => effect.visible)
  const shadows = visible.filter(
    (effect) => effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW'
  )
  if (shadows.length > 0)
    style['box-shadow'] = shadows.map((shadow) => shadowToCSS(shadow)).join(', ')
  for (const effect of visible) {
    if (effect.type === 'LAYER_BLUR' || effect.type === 'FOREGROUND_BLUR')
      style.filter = blurToCSS(effect)
    if (effect.type === 'BACKGROUND_BLUR') style['backdrop-filter'] = blurToCSS(effect)
  }
  return style
}

/**
 * Text's effects: each visible drop shadow as `text-shadow`, which has no spread and shadows the
 * glyphs, and a layer blur. An inner shadow has no form CSS gives text.
 */
export function textEffectsToCSS(effects: Effect[]): DesignStyleDeclaration {
  const style: DesignStyleDeclaration = {}
  const visible = effects.filter((effect) => effect.visible)
  const shadows = visible.filter((effect) => effect.type === 'DROP_SHADOW')
  if (shadows.length > 0) {
    style['text-shadow'] = shadows.map((shadow) => shadowToCSS(shadow, false)).join(', ')
  }
  for (const effect of visible) {
    if (effect.type === 'LAYER_BLUR' || effect.type === 'FOREGROUND_BLUR')
      style.filter = blurToCSS(effect)
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

/** The stops, each at `place(position)`, its own position unless the gradient line differs. */
function gradientStopsCSS(fill: Fill, place: (position: number) => number = (p) => p): string {
  return (fill.gradientStops ?? [])
    .map(
      (stop) =>
        `${cssColor({ ...stop.color, a: stop.color.a * fill.opacity })} ${percent(place(stop.position))}`
    )
    .join(', ')
}

/**
 * Where a linear gradient's stops fall on CSS's gradient line, which runs through the box's
 * centre at the gradient's angle and ends where the corners meet it: a stop at `position` along
 * the paint's own handles lands at the share of that line its point lies at, so the colours sit
 * where the canvas draws them whatever the angle and the box.
 */
function cssLinePosition(
  fill: Fill,
  width: number,
  height: number,
  angle: number
): (position: number) => number {
  const t = fill.gradientTransform
  if (!t || width <= 0 || height <= 0) return (position) => position
  const start = gradientPoint(t, { x: 0, y: 0.5 })
  const end = gradientPoint(t, { x: 1, y: 0.5 })
  const radians = (angle * Math.PI) / 180
  const direction = { x: Math.sin(radians), y: -Math.cos(radians) }
  const length = Math.abs(width * direction.x) + Math.abs(height * direction.y)
  return (position) => {
    const x = (start.x + (end.x - start.x) * position) * width - width / 2
    const y = (start.y + (end.y - start.y) * position) * height - height / 2
    return (x * direction.x + y * direction.y) / length + 0.5
  }
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
    const angle = gradientAngle(fill, width, height)
    const stops = gradientStopsCSS(fill, cssLinePosition(fill, width, height, angle))
    return `linear-gradient(${angle}deg, ${stops})`
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
