import type { Color } from './primitives'
import type { GlassEffectParams, NoiseEffectParams, TextureEffectParams } from './types'

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
/** The grain of a noise effect whose values are missing: none of the layer covered. */
export const UNSET_NOISE: Readonly<NoiseEffectParams> = {
  noiseType: 'MONOTONE',
  noiseSize: { x: 1, y: 1 },
  density: 0
}
/** A new noise effect's grain, as Figma's effects panel starts one: black at 25%, fully dense. */
export const DEFAULT_NOISE: Readonly<NoiseEffectParams> = {
  noiseType: 'MONOTONE',
  noiseSize: { x: 0.5, y: 0.5 },
  density: 1
}
/** The colour a new noise effect's grains start in. */
export const DEFAULT_NOISE_COLOR: Readonly<Color> = { r: 0, g: 0, b: 0, a: 0.25 }
/** A new texture effect's grain, as Figma's effects panel starts one, with a radius of 4. */
export const DEFAULT_TEXTURE: Readonly<TextureEffectParams> = {
  noiseSize: { x: 4, y: 4 },
  clipToShape: false
}
/** The grain of a texture effect whose values are missing; its radius of 0 moves nothing. */
export const UNSET_TEXTURE: Readonly<TextureEffectParams> = {
  noiseSize: { x: 1, y: 1 },
  clipToShape: true
}
/** The lens a new glass effect starts with when nothing sets its values. */
export const DEFAULT_GLASS: Readonly<GlassEffectParams> = {
  refraction: 0.5,
  depth: 20,
  lightAngle: -45,
  lightIntensity: 0.5,
  dispersion: 0
}
export const DEFAULT_FONT_FAMILY = 'Inter'
export const DEFAULT_STROKE_MITER_LIMIT = 4
export const DEFAULT_STROKE_WEIGHT = 1
