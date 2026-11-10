import { uniq } from 'es-toolkit'

import type { CanvasKit, ImageFilter, TileMode } from '@open-pencil/canvaskit'
import type { ProgressiveBlur } from '@open-pencil/scene-graph'
import { blurSigma } from '@open-pencil/scene-graph/geometry'
import type { Vector } from '@open-pencil/scene-graph/primitives'

/**
 * How far apart neighbouring blur levels sit: each is this much wider than the last, or this many
 * sigma more. Two neighbours mixed to the sigma between them draw within 2/255 of a single blur.
 */
const LEVEL_RATIO = 1.4
const LEVEL_MIN_STEP = 0.5

/**
 * Points each level's mask gradient samples its weight at between two neighbouring levels. The
 * weight follows the square of the sigma, so a few points per level keep the straight lines the
 * gradient draws between them on its curve.
 */
const STOPS_PER_LEVEL = 4

/** A progressive blur placed in the filter's coordinates: sigmas at the start and end points. */
export interface ProgressiveBlurRamp {
  start: Vector
  end: Vector
  startSigma: number
  endSigma: number
}

/**
 * The ramp a progressive blur draws in a `width` × `height` layer, its points mapped by `toFilter`
 * into the coordinates the filter runs in. `radius` is the blur's radius at its end.
 */
export function progressiveBlurRamp(
  progressive: ProgressiveBlur,
  radius: number,
  width: number,
  height: number,
  toFilter: (point: Vector) => Vector = (point) => point
): ProgressiveBlurRamp {
  return {
    start: toFilter({
      x: progressive.startOffset.x * width,
      y: progressive.startOffset.y * height
    }),
    end: toFilter({ x: progressive.endOffset.x * width, y: progressive.endOffset.y * height }),
    startSigma: blurSigma(progressive.startRadius),
    endSigma: blurSigma(radius)
  }
}

/** The sigmas a ramp from `from` to `to` mixes between, in increasing order. */
export function blurLevels(from: number, to: number): number[] {
  const low = Math.min(from, to)
  const high = Math.max(from, to)
  const levels = [low]
  for (
    let sigma = Math.max(low * LEVEL_RATIO, low + LEVEL_MIN_STEP);
    sigma < high;
    sigma = Math.max(sigma * LEVEL_RATIO, sigma + LEVEL_MIN_STEP)
  ) {
    levels.push(sigma)
  }
  if (high > low) levels.push(high)
  return levels
}

/**
 * How much of each level a pixel blurred by `sigma` takes: the two levels around it, mixed so the
 * mix spreads as far as a single blur of `sigma` (their variances average to its own).
 */
export function levelWeights(levels: readonly number[], sigma: number): number[] {
  const weights = levels.map(() => 0)
  const upper = levels.findIndex((level) => level >= sigma)
  if (upper <= 0) {
    weights[upper === 0 ? 0 : levels.length - 1] = 1
    return weights
  }
  const below = levels[upper - 1] ** 2
  const share = (sigma ** 2 - below) / (levels[upper] ** 2 - below)
  weights[upper - 1] = 1 - share
  weights[upper] = share
  return weights
}

/**
 * Where along the ramp, from 0 at its start to 1 at its end, each level's mask samples its weight:
 * at every level the sigma passes and evenly between them.
 */
export function maskStops(
  levels: readonly number[],
  startSigma: number,
  endSigma: number
): number[] {
  const along = (sigma: number) => (sigma - startSigma) / (endSigma - startSigma)
  const stops = [0, 1]
  for (const [index, level] of levels.entries()) {
    const next = levels.at(index + 1)
    if (next === undefined) break
    for (let step = 0; step < STOPS_PER_LEVEL; step++) {
      stops.push(along(level + ((next - level) * step) / STOPS_PER_LEVEL))
    }
  }
  return uniq(stops.filter((t) => t >= 0 && t <= 1)).sort((a, b) => a - b)
}

/**
 * Whether a ramp draws as a plain blur of its end radius: Figma draws one with no length that way,
 * and one with the same radius at both ends is one.
 */
export function isPlainRamp(ramp: ProgressiveBlurRamp): boolean {
  const length = Math.hypot(ramp.end.x - ramp.start.x, ramp.end.y - ramp.start.y)
  return ramp.startSigma === ramp.endSigma || length < 1e-6
}

/**
 * Figma's progressive blur: each pixel blurred by the sigma the ramp reaches at it, in two passes
 * as Figma blurs. Each pass mixes plain blurs at a few levels, weighted per pixel by a
 * gradient along the ramp. A plain ramp (`isPlainRamp`) is drawn as a plain blur instead.
 */
export function makeProgressiveBlur(
  ck: CanvasKit,
  ramp: ProgressiveBlurRamp,
  tile: TileMode
): ImageFilter {
  const levels = blurLevels(ramp.startSigma, ramp.endSigma)
  const stops = maskStops(levels, ramp.startSigma, ramp.endSigma)
  const weights = stops.map((t) =>
    levelWeights(levels, ramp.startSigma + (ramp.endSigma - ramp.startSigma) * t)
  )
  const masks = levels.map((_, level) =>
    ck.Shader.MakeLinearGradient(
      [ramp.start.x, ramp.start.y],
      [ramp.end.x, ramp.end.y],
      weights.map((weight) => ck.Color4f(0, 0, 0, weight[level])),
      stops,
      ck.TileMode.Clamp
    )
  )
  const made: ImageFilter[] = []
  const keep = (filter: ImageFilter) => {
    made.push(filter)
    return filter
  }
  const pass = (axis: 'x' | 'y', input: ImageFilter | null): ImageFilter => {
    let sum: ImageFilter | null = null
    for (const [level, sigma] of levels.entries()) {
      const blurred =
        sigma > 0
          ? keep(
              ck.ImageFilter.MakeBlur(
                axis === 'x' ? sigma : 0,
                axis === 'y' ? sigma : 0,
                tile,
                input
              )
            )
          : input
      const mask = keep(ck.ImageFilter.MakeShader(masks[level]))
      const term = keep(ck.ImageFilter.MakeBlend(ck.BlendMode.DstIn, blurred, mask))
      sum = sum ? keep(ck.ImageFilter.MakeBlend(ck.BlendMode.Plus, sum, term)) : term
    }
    if (!sum) throw new Error('A progressive blur mixes at least one level')
    return sum
  }
  // Figma blurs across the ramp first and along it second, so a pixel just past a steep ramp's
  // end gathers pixels blurred less than itself.
  const along =
    Math.abs(ramp.end.y - ramp.start.y) >= Math.abs(ramp.end.x - ramp.start.x) ? 'y' : 'x'
  const filter = pass(along, pass(along === 'y' ? 'x' : 'y', null))
  // Each filter holds what it is made from, so only the result needs keeping.
  for (const part of made) if (part !== filter) part.delete()
  for (const mask of masks) mask.delete()
  return filter
}
