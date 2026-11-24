import type { Effect, NoiseEffectParams, TextureEffectParams } from '@open-pencil/scene-graph'
import { UNSET_NOISE, UNSET_TEXTURE } from '@open-pencil/scene-graph/constants'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { floodColor, type FilterBuilder } from './filter'
import { svg } from './node'
import { round } from './paths'

/** How many steps the discrete alpha table of a noise has, as Figma writes it. */
const NOISE_TABLE_STEPS = 100

/** Keeps a channel's alpha alone, as each of Figma's grain matrices does somewhere. */
const ALPHA_ONLY = '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'
const ALPHA_TO_RED = '0 0 0 1 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1'
const ALPHA_TO_GREEN = '0 0 0 0 0  0 0 0 1 0  0 0 0 0 0  0 0 0 0 1'
const OPAQUE = '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 127 0'
const ALPHA_TO_RED_OPAQUE = '0 0 0 1 0  0 0 0 0 0  0 0 0 0 0  0 0 0 127 0'
const RED_TO_ALPHA = '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0'

/** A grain size as `feTurbulence` frequency, one cycle per grain on each axis. */
function grainFrequency(size: Vector): string {
  const frequency = (length: number) => (length > 0 ? round(1 / length, 4) : 0)
  return `${frequency(size.x)} ${frequency(size.y)}`
}

/**
 * The discrete alpha table that shows a noise's grains at `density`, as Figma's SVG export writes
 * it: a band of ones over the noise's middle tones, one step wide at no density and half the
 * steps at full. Figma works it out in 32-bit floats, as it stores the density.
 */
export function noiseDensityTable(density: number, mirrored = false): string {
  const stored = Math.fround(density)
  const start = Math.floor(25 - 25 * stored)
  const count = Math.floor(50 * stored) + 1
  const steps = Array.from({ length: NOISE_TABLE_STEPS }, (_, step) =>
    step >= start && step < start + count ? 1 : 0
  )
  return (mirrored ? steps.reverse() : steps).join(' ')
}

/**
 * A noise effect over `input` as Figma's SVG export draws it: fractal noise one grain to a
 * cycle, its middle tones shown in the effect's colour, a duotone's opposite tones in its
 * second colour, and a multitone's own colours at its opacity, all inside the layer. Returns the
 * result's name.
 */
export function noiseFilter(filter: FilterBuilder, effect: Effect, input: string): string {
  const grain: NoiseEffectParams = effect.noise ?? UNSET_NOISE
  const noise = filter.result('noise')
  filter.push('feTurbulence', {
    type: 'fractalNoise',
    baseFrequency: grainFrequency(grain.noiseSize),
    stitchTiles: 'stitch',
    numOctaves: 3,
    seed: grain.seed ?? 0,
    result: noise
  })
  const merged = filter.result('noiseMerge')
  if (grain.noiseType === 'MULTITONE') {
    const colored = filter.result('multitone')
    const linear = { type: 'linear', slope: 2, intercept: -0.5 }
    filter.push(
      'feComponentTransfer',
      { in: noise, result: colored },
      svg('feFuncR', linear),
      svg('feFuncG', linear),
      svg('feFuncB', linear),
      svg('feFuncA', { type: 'discrete', tableValues: noiseDensityTable(grain.density) })
    )
    const clipped = filter.result('noiseClipped')
    filter.push('feComposite', { in: colored, in2: input, operator: 'in', result: clipped })
    const faded = filter.result('noiseColor')
    filter.push(
      'feComponentTransfer',
      { in: clipped, result: faded },
      svg('feFuncA', { type: 'table', tableValues: `0 ${round(grain.opacity ?? 1)}` })
    )
    filter.pushElement('feMerge', { result: merged }, mergeNodes([input, faded]))
    return merged
  }

  const alpha = filter.result('alphaNoise')
  filter.push('feColorMatrix', { in: noise, type: 'luminanceToAlpha', result: alpha })
  const tones = [{ color: effect.color, mirrored: false }]
  if (grain.noiseType === 'DUOTONE') {
    tones.push({ color: grain.secondaryColor ?? effect.color, mirrored: true })
  }
  const colors = tones.map(({ color, mirrored }) => {
    const band = filter.result('noiseBand')
    filter.push(
      'feComponentTransfer',
      { in: alpha, result: band },
      svg('feFuncA', { type: 'discrete', tableValues: noiseDensityTable(grain.density, mirrored) })
    )
    const clipped = filter.result('noiseClipped')
    filter.push('feComposite', { in: band, in2: input, operator: 'in', result: clipped })
    const flood = filter.result('noiseFlood')
    filter.push('feFlood', {
      'flood-color': floodColor(color, filter.colors),
      'flood-opacity': round(color.a),
      result: flood
    })
    const colored = filter.result('noiseColor')
    filter.push('feComposite', { in: flood, in2: clipped, operator: 'in', result: colored })
    return colored
  })
  filter.pushElement('feMerge', { result: merged }, mergeNodes([input, ...colors]))
  return merged
}

function mergeNodes(inputs: readonly string[]) {
  return inputs.map((input) => svg('feMergeNode', { in: input }))
}

/**
 * A texture effect over `input` as Figma's SVG export draws it: the layer displaced by fractal
 * noise one grain to a cycle, twice the radius at most. Without clipping that is all; clipped to
 * its shape, Figma's chain moves only the layer's inside and keeps it within its own outline.
 * Returns the result's name.
 */
export function textureFilter(filter: FilterBuilder, effect: Effect, input: string): string {
  const grain: TextureEffectParams = effect.texture ?? UNSET_TEXTURE
  const frequency = grainFrequency(grain.noiseSize)
  const scale = round(effect.radius * 2)
  const name = (label: string) => filter.result(label)
  const displace = (into: string, by: string, result: string) =>
    filter.push('feDisplacementMap', {
      in: into,
      in2: by,
      scale,
      xChannelSelector: 'R',
      yChannelSelector: 'G',
      width: '100%',
      height: '100%',
      result
    })
  const turbulence = (seed: number, result: string) =>
    filter.push('feTurbulence', {
      type: 'fractalNoise',
      baseFrequency: frequency,
      numOctaves: 3,
      seed: (grain.seed ?? 0) + seed,
      result
    })
  const matrix = (into: string, values: string, result: string) =>
    filter.push('feColorMatrix', { in: into, type: 'matrix', values, result })
  const arithmetic = (
    into: string,
    by: string,
    k: [number, number, number, number],
    result: string
  ) =>
    filter.push('feComposite', {
      in: into,
      in2: by,
      operator: 'arithmetic',
      k1: k[0],
      k2: k[1],
      k3: k[2],
      k4: k[3],
      result
    })
  const composite = (into: string, by: string, operator: string, result: string) =>
    filter.push('feComposite', { in: into, in2: by, operator, result })
  const gamma = (into: string, result: string) =>
    filter.push(
      'feComponentTransfer',
      { in: into, result },
      svg('feFuncA', { type: 'gamma', exponent: 0.2 })
    )

  if (!grain.clipToShape) {
    const noise = name('textureNoise')
    turbulence(0, noise)
    const displaced = name('texture')
    displace(input, noise, displaced)
    return displaced
  }

  const noiseX = name('displacementX')
  const noiseY = name('displacementY')
  turbulence(0, noiseX)
  turbulence(1, noiseY)
  const xRed = name('displacementXRed')
  matrix(noiseX, ALPHA_TO_RED, xRed)
  const yGreen = name('displacementYGreen')
  matrix(noiseY, ALPHA_TO_GREEN, yGreen)
  const xy = name('displacementXY')
  arithmetic(xRed, yGreen, [0, 1, 1, 0], xy)
  const firstPass = name('firstPass')
  displace(input, xy, firstPass)
  const firstAlpha = name('firstPassAlpha')
  matrix(firstPass, ALPHA_ONLY, firstAlpha)
  const displacedAlpha = name('sourceDisplacedAlpha')
  gamma(firstAlpha, displacedAlpha)
  const inputAlphaOnly = name('inputAlphaOnly')
  matrix(input, ALPHA_ONLY, inputAlphaOnly)
  const inputAlpha = name('inputSourceAlpha')
  gamma(inputAlphaOnly, inputAlpha)
  const alphas = name('displacementAlphasMultiplied')
  arithmetic(displacedAlpha, inputAlpha, [1, 0, 0, 0], alphas)
  const centering = name('centeringAdjustment')
  arithmetic(alphas, alphas, [0, 0, -0.5, 0.5], centering)

  const finalChannel = (noise: string, values: string, label: string) => {
    const weighted = name(`${label}Weighted`)
    arithmetic(noise, alphas, [1, 0, 0, 0], weighted)
    const centered = name(`${label}Centered`)
    arithmetic(centering, weighted, [0, 1, 1, 0], centered)
    const final = name(`${label}Final`)
    matrix(centered, values, final)
    return final
  }
  const xFinal = finalChannel(noiseX, ALPHA_TO_RED, 'displacementX')
  const yFinal = finalChannel(noiseY, ALPHA_TO_GREEN, 'displacementY')
  const combined = name('displacementCombined')
  arithmetic(xFinal, yFinal, [0, 1, 1, 0], combined)
  const map = name('displacementMap')
  composite(combined, alphas, 'in', map)
  const neutral = name('neutral')
  filter.push('feFlood', {
    'flood-color': 'rgb(127, 127, 127)',
    'flood-opacity': 1,
    result: neutral
  })
  const outside = name('neutralOutside')
  composite(neutral, alphas, 'out', outside)
  const mapWithBackground = name('displacementMapWithBg')
  composite(outside, map, 'over', mapWithBackground)

  const displaced = name('displacedImage')
  displace(input, mapWithBackground, displaced)
  const opaque = name('imageOpaque')
  matrix(input, OPAQUE, opaque)
  const displacedOpaque = name('displacedImageOpaque')
  displace(opaque, mapWithBackground, displacedOpaque)
  const displacedRed = name('displacedImageRed')
  matrix(displaced, ALPHA_TO_RED_OPAQUE, displacedRed)
  const inputRed = name('inputRed')
  matrix(input, ALPHA_TO_RED_OPAQUE, inputRed)
  const transparencyRed = name('transparencyRedMap')
  composite(displacedRed, inputRed, 'atop', transparencyRed)
  const transparency = name('transparencyAlphaMap')
  matrix(transparencyRed, RED_TO_ALPHA, transparency)
  const layered = name('textureLayered')
  composite(displacedOpaque, opaque, 'over', layered)
  const textured = name('texture')
  composite(layered, transparency, 'in', textured)
  return textured
}
