import type { BlendMode, Effect } from '@open-pencil/scene-graph'
import type { Color, Vector } from '@open-pencil/scene-graph/primitives'

import { parseColor } from '#core/color'
import { TRANSPARENT } from '#core/constants'

export type EffectColor = string | Color

export interface ShadowEffectOptions {
  color?: EffectColor
  x?: number
  y?: number
  offset?: Vector
  radius?: number
  spread?: number
  visible?: boolean
  blendMode?: BlendMode
  showShadowBehindNode?: boolean
}

export interface BlurEffectOptions {
  radius?: number
  visible?: boolean
}

function toColor(color: EffectColor | undefined): Color {
  if (color === undefined) return { ...TRANSPARENT }
  return typeof color === 'string' ? parseColor(color) : color
}

function shadowEffect(type: 'DROP_SHADOW' | 'INNER_SHADOW', options: ShadowEffectOptions): Effect {
  return {
    type,
    color: toColor(options.color ?? 'rgba(0, 0, 0, 0.25)'),
    offset: options.offset ?? { x: options.x ?? 0, y: options.y ?? 4 },
    radius: options.radius ?? 8,
    spread: options.spread ?? 0,
    visible: options.visible ?? true,
    blendMode: options.blendMode,
    showShadowBehindNode: options.showShadowBehindNode
  }
}

function blurEffect(
  type: 'LAYER_BLUR' | 'BACKGROUND_BLUR' | 'FOREGROUND_BLUR',
  radiusOrOptions: number | BlurEffectOptions = 8
): Effect {
  const options =
    typeof radiusOrOptions === 'number' ? { radius: radiusOrOptions } : radiusOrOptions
  return {
    type,
    color: { ...TRANSPARENT },
    offset: { x: 0, y: 0 },
    radius: options.radius ?? 8,
    spread: 0,
    visible: options.visible ?? true
  }
}

export function dropShadow(options: ShadowEffectOptions = {}): Effect {
  return shadowEffect('DROP_SHADOW', options)
}

export function innerShadow(options: ShadowEffectOptions = {}): Effect {
  return shadowEffect('INNER_SHADOW', options)
}

export function layerBlur(radiusOrOptions?: number | BlurEffectOptions): Effect {
  return blurEffect('LAYER_BLUR', radiusOrOptions)
}

export function backgroundBlur(radiusOrOptions?: number | BlurEffectOptions): Effect {
  return blurEffect('BACKGROUND_BLUR', radiusOrOptions)
}

export function foregroundBlur(radiusOrOptions?: number | BlurEffectOptions): Effect {
  return blurEffect('FOREGROUND_BLUR', radiusOrOptions)
}
