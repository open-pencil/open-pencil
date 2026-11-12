import type { BlendMode, Effect, GlassEffectParams } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'
import { BLACK, DEFAULT_GLASS, TRANSPARENT } from '@open-pencil/scene-graph/constants'
import type { Color, Vector } from '@open-pencil/scene-graph/primitives'

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

/** What every blurring effect takes: how far it blurs, and whether it shows. */
interface BlurringEffectOptions {
  radius?: number
  visible?: boolean
}

export interface BlurEffectOptions extends BlurringEffectOptions {
  /** The blur's radius, or a progressive blur's radius at its end. */
  radius?: number
  /**
   * Any of these makes the blur progressive, growing from `startRadius` (0 by default) at
   * `startOffset` to `radius` at `endOffset`, fractions of the layer's size: top centre to bottom
   * centre by default.
   */
  startRadius?: number
  startOffset?: Vector
  endOffset?: Vector
}

/** A progressive blur's start and end when a call leaves them out: top centre to bottom centre. */
const PROGRESSIVE_START: Vector = { x: 0.5, y: 0 }
const PROGRESSIVE_END: Vector = { x: 0.5, y: 1 }

/** A glass lens in Figma's terms, with `radius` frosting it. */
export type GlassEffectOptions = Partial<GlassEffectParams> & BlurringEffectOptions

/** The lens a `glass()` call gets for each value it leaves out. */

/** Radius of a shadow or blur that does not set one. */
const DEFAULT_EFFECT_RADIUS = 8

function toColor(color: EffectColor | undefined): Color {
  if (color === undefined) return { ...TRANSPARENT }
  return typeof color === 'string' ? parseColor(color) : color
}

function shadowEffect(type: 'DROP_SHADOW' | 'INNER_SHADOW', options: ShadowEffectOptions): Effect {
  return {
    type,
    color: toColor(options.color ?? 'rgba(0, 0, 0, 0.25)'),
    offset: options.offset ?? { x: options.x ?? 0, y: options.y ?? 4 },
    radius: options.radius ?? DEFAULT_EFFECT_RADIUS,
    spread: options.spread ?? 0,
    visible: options.visible ?? true,
    blendMode: options.blendMode,
    showShadowBehindNode: options.showShadowBehindNode
  }
}

function blurEffect(
  type: 'LAYER_BLUR' | 'BACKGROUND_BLUR' | 'FOREGROUND_BLUR',
  radiusOrOptions: number | BlurEffectOptions = {}
): Effect {
  const options =
    typeof radiusOrOptions === 'number' ? { radius: radiusOrOptions } : radiusOrOptions
  return {
    type,
    color: { ...TRANSPARENT },
    offset: { x: 0, y: 0 },
    radius: options.radius ?? DEFAULT_EFFECT_RADIUS,
    spread: 0,
    visible: options.visible ?? true,
    ...(options.startRadius !== undefined ||
    options.startOffset !== undefined ||
    options.endOffset !== undefined
      ? {
          progressive: {
            startRadius: options.startRadius ?? 0,
            startOffset: { ...(options.startOffset ?? PROGRESSIVE_START) },
            endOffset: { ...(options.endOffset ?? PROGRESSIVE_END) }
          }
        }
      : {})
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

export function glass(options: GlassEffectOptions = {}): Effect {
  return {
    type: 'GLASS',
    color: { ...BLACK },
    offset: { x: 0, y: 0 },
    radius: options.radius ?? 0,
    spread: 0,
    visible: options.visible ?? true,
    glass: {
      refraction: options.refraction ?? DEFAULT_GLASS.refraction,
      depth: options.depth ?? DEFAULT_GLASS.depth,
      lightAngle: options.lightAngle ?? DEFAULT_GLASS.lightAngle,
      lightIntensity: options.lightIntensity ?? DEFAULT_GLASS.lightIntensity,
      dispersion: options.dispersion ?? DEFAULT_GLASS.dispersion
    }
  }
}
