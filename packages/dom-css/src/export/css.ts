import type { Effect, Fill, Stroke, TextLength } from '@open-pencil/scene-graph'
import { colorToCSS, colorToHex } from '@open-pencil/scene-graph/color'
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

/** A bound field's CSS: `var()` where its variable draws the value, else the literal. */
export type EffectFieldCSS = (field: string, literal: string) => string

const LITERAL: EffectFieldCSS = (_field, literal) => literal

function shadowToCSS(effect: Effect, index: number, css: EffectFieldCSS): string {
  const inset = effect.type === 'INNER_SHADOW' ? 'inset ' : ''
  const length = (property: string, value: number) =>
    css(`effects/${index}/${property}`, `${value}px`)
  return [
    `${inset}${length('offsetX', effect.offset.x)}`,
    length('offsetY', effect.offset.y),
    length('radius', effect.radius),
    length('spread', effect.spread),
    css(`effects/${index}/color`, cssColor(effect.color))
  ].join(' ')
}

/** The first effect as a drop shadow, as a text's `text-shadow` writes it. */
export function dropShadowToCSS(effect: Effect | undefined, css = LITERAL): string | undefined {
  if (effect?.type !== 'DROP_SHADOW' || !effect.visible) return undefined
  return shadowToCSS(effect, 0, css)
}

const isShadow = (effect: Effect) => effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW'

/**
 * Every visible shadow, in order, plus layer and background blur. `css` names the variable a
 * bound field, such as `effects/0/radius`, draws from.
 */
export function effectsToCSS(effects: Effect[], css = LITERAL): DesignStyleDeclaration {
  const style: DesignStyleDeclaration = {}
  const visible = [...effects.entries()].filter(([, effect]) => effect.visible)
  const shadows = visible.filter(([, effect]) => isShadow(effect))
  if (shadows.length > 0)
    style['box-shadow'] = shadows
      .map(([index, effect]) => shadowToCSS(effect, index, css))
      .join(', ')
  for (const [index, effect] of visible) {
    const blur = () => `blur(${css(`effects/${index}/radius`, `${effect.radius}px`)})`
    if (effect.type === 'LAYER_BLUR' || effect.type === 'FOREGROUND_BLUR') style.filter = blur()
    if (effect.type === 'BACKGROUND_BLUR') style['backdrop-filter'] = blur()
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
