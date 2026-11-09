import type { Color } from './primitives'
import type { GlassEffectParams } from './types'

export const BLACK: Color = { r: 0, g: 0, b: 0, a: 1 }
export const WHITE: Color = { r: 1, g: 1, b: 1, a: 1 }
export const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 }
/** The lens of a glass effect whose values are missing: the least it can be, so it bends nothing. */
export const UNSET_GLASS: Readonly<GlassEffectParams> = {
  refraction: 0,
  depth: 1,
  lightAngle: 0,
  lightIntensity: 0,
  dispersion: 0
}
export const DEFAULT_FONT_FAMILY = 'Inter'
export const DEFAULT_STROKE_MITER_LIMIT = 4
export const DEFAULT_STROKE_WEIGHT = 1
