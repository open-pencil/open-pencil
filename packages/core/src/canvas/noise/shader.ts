/**
 * Figma's noise effect as a Skia runtime shader. Figma's own generator is not public, and a
 * bounded search for it failed, so this draws noise with Figma's statistics instead, measured from
 * Figma 126 PNG exports: the exact spread over 17 levels at every density for grain size 1, and
 * for larger grains the spread, saturation, and pixel-to-pixel correlation of each size. Grains
 * larger than 1 at partial density come out darker than Figma's, whose interplay of the two
 * remains unmeasured.
 */

import type { Effect, NoiseEffectParams } from '@open-pencil/scene-graph'
import { UNSET_NOISE } from '@open-pencil/scene-graph/constants'
import Matrix, { type Mat3 } from '@open-pencil/scene-graph/matrix'

import { defineShader, type Float2, type Float4 } from '#core/canvas/sksl'

import grainSource from './grain.sksl?raw'
import { noiseLevelShares, noiseMeanLevel } from './table'

interface NoiseUniforms {
  cell: Float2
  contrast: number
  center: number
  mode: number
  primary: Float4
  secondary: Float4
  opacity: number
  snap: number
  toOutputX: Float2
  toOutputY: Float2
  toOutputOrigin: Float2
  fromOutputX: Float2
  fromOutputY: Float2
  fromOutputOrigin: Float2
}

/** The axes and origin of an affine `matrix`, as the shader reads them. */
function affine(matrix: Mat3): [Float2, Float2, Float2] {
  const [xx, xy, tx, yx, yy, ty] = matrix
  return [
    [xx, yx],
    [xy, yy],
    [tx, ty]
  ]
}

/**
 * Where the layer lands on a supersampled export's pixels, so the shader samples once per output
 * pixel, as Figma's statistics are measured; null draws at every rendered pixel.
 */
function outputSnap(layerToOutput: Mat3 | null) {
  const outputToLayer = layerToOutput && Matrix.invert(layerToOutput)
  if (!layerToOutput || !outputToLayer) {
    const none: Float2 = [0, 0]
    return {
      snap: 0,
      toOutputX: none,
      toOutputY: none,
      toOutputOrigin: none,
      fromOutputX: none,
      fromOutputY: none,
      fromOutputOrigin: none
    }
  }
  const [toOutputX, toOutputY, toOutputOrigin] = affine(layerToOutput)
  const [fromOutputX, fromOutputY, fromOutputOrigin] = affine(outputToLayer)
  return {
    snap: 1,
    toOutputX,
    toOutputY,
    toOutputOrigin,
    fromOutputX,
    fromOutputY,
    fromOutputOrigin
  }
}

export const NOISE_GRAIN = defineShader<NoiseUniforms>('noise grain', grainSource)

/**
 * How much Figma stretches its grains' contrast at each grain size, fitted to the spread of its
 * exports: under 1 its pixels average several grains and lose contrast, over 1 it sharpens the
 * blend between grains until large ones are nearly all on or off.
 */
const CONTRAST_BY_SIZE: readonly (readonly [number, number])[] = [
  [0.25, 0.36],
  [0.5, 0.457],
  [0.75, 0.595],
  [1, 1],
  [1.5, 1.34],
  [2, 1.84],
  [3, 2.45],
  [4, 3.16],
  [6, 4.5],
  [8, 5.73],
  [16, 11.48]
]

/** Figma's contrast for grain `size`, between the fitted sizes and along their trend beyond. */
export function noiseContrast(size: number): number {
  const first = CONTRAST_BY_SIZE[0]
  const last = CONTRAST_BY_SIZE[CONTRAST_BY_SIZE.length - 1]
  if (size <= first[0]) return first[1]
  if (size >= last[0]) return 0.7 * size + 0.3
  const upper = CONTRAST_BY_SIZE.findIndex(([at]) => at >= size)
  const [s0, k0] = CONTRAST_BY_SIZE[upper - 1]
  const [s1, k1] = CONTRAST_BY_SIZE[upper]
  return k0 + ((k1 - k0) * (size - s0)) / (s1 - s0)
}

/**
 * The cell, in layer units, Figma's grains of `size` vary over: one unit at size 1 and below,
 * where each pixel is its own grain, and about 0.4 · size + 0.45 above, fitted to how far apart
 * Figma's pixels stop matching.
 */
export function noiseCell(size: number): number {
  return size <= 1 ? 1 : 0.4 * size + 0.45
}

const NOISE_MODE: Record<NoiseEffectParams['noiseType'], number> = {
  MONOTONE: 0,
  DUOTONE: 1,
  MULTITONE: 2
}

/**
 * What the shader's `levels` and `colors` tiles are made from: the shares of pixels at each level
 * for the density, and the seed; and whether cells wider than a pixel blend between each other.
 */
export function noiseTileInputs(effect: Effect) {
  const grain = effect.noise ?? UNSET_NOISE
  return {
    shares: noiseLevelShares(grain.density),
    seed: grain.seed ?? 0,
    blend: Math.max(noiseCell(grain.noiseSize.x), noiseCell(grain.noiseSize.y)) > 1
  }
}

/**
 * The shader's uniforms for a noise `effect`, a cell per axis and the contrast of the larger, sampled
 * once per output pixel where `layerToOutput` maps the layer onto a supersampled export.
 */
export function noiseUniforms(effect: Effect, layerToOutput: Mat3 | null = null): NoiseUniforms {
  const grain = effect.noise ?? UNSET_NOISE
  const size = Math.max(grain.noiseSize.x, grain.noiseSize.y)
  const shares = noiseLevelShares(grain.density)
  const cell: Float2 = [noiseCell(grain.noiseSize.x), noiseCell(grain.noiseSize.y)]
  const secondary = grain.secondaryColor ?? effect.color
  return {
    cell,
    contrast: noiseContrast(size),
    center: noiseMeanLevel(shares),
    mode: NOISE_MODE[grain.noiseType],
    primary: [effect.color.r, effect.color.g, effect.color.b, effect.color.a],
    secondary: [secondary.r, secondary.g, secondary.b, secondary.a],
    opacity: grain.opacity ?? 1,
    ...outputSnap(layerToOutput)
  }
}
