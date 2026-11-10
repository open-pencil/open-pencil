import { uniq } from 'es-toolkit'

import type { CanvasKit, Image, ImageFilter, Shader, TileMode } from '@open-pencil/canvaskit'
import type { ProgressiveBlur } from '@open-pencil/scene-graph'
import { blurSigma, type VisualBounds } from '@open-pencil/scene-graph/geometry'
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
  /**
   * Where the blurred content lies, in the filter's coordinates. Each level blurs only the part of
   * it its band of the ramp covers; without bounds, a band runs on without end across the ramp.
   */
  bounds: VisualBounds | null
}

/** How far a band reaches across the ramp when nothing bounds the content. */
const UNBOUNDED = 1e7

/**
 * The ramp a progressive blur draws in a `width` × `height` layer, its points mapped by `toFilter`
 * into the coordinates the filter runs in. `radius` is the blur's radius at its end.
 */
export function progressiveBlurRamp(
  progressive: ProgressiveBlur,
  radius: number,
  width: number,
  height: number,
  bounds: VisualBounds | null,
  toFilter: (point: Vector) => Vector = (point) => point
): ProgressiveBlurRamp {
  return {
    bounds,
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
 * Where along the ramp a level's weight is not zero, from 0 at the start to 1 at the end: between
 * the levels below and above it, the lowest and highest reaching past the ends of the ramp.
 */
function levelBand(
  ramp: ProgressiveBlurRamp,
  levels: readonly number[],
  level: number
): [number, number] {
  const below = levels.at(level - 1) ?? -Infinity
  const above = levels.at(level + 1) ?? Infinity
  const lower = level === 0 ? -Infinity : below
  const along = (sigma: number) =>
    Number.isFinite(sigma)
      ? (sigma - ramp.startSigma) / (ramp.endSigma - ramp.startSigma)
      : Math.sign(sigma) * Math.sign(ramp.endSigma - ramp.startSigma) * Infinity
  const ends = [along(lower), along(above)]
  return [Math.min(...ends), Math.max(...ends)]
}

/** The corners of `polygon` on the side of a line where `side` is not negative. */
function clipPolygon(polygon: readonly Vector[], side: (point: Vector) => number): Vector[] {
  const clipped: Vector[] = []
  for (const [index, point] of polygon.entries()) {
    const next = polygon[(index + 1) % polygon.length]
    const here = side(point)
    const there = side(next)
    if (here >= 0) clipped.push(point)
    if (here >= 0 !== there >= 0) {
      const t = here / (here - there)
      clipped.push({ x: point.x + (next.x - point.x) * t, y: point.y + (next.y - point.y) * t })
    }
  }
  return clipped
}

/**
 * The box around the part of the content whose place along the ramp lies between `from` and `to`,
 * widened by `margin` filter units along the ramp; null when no content lies there.
 */
function bandBox(
  ramp: ProgressiveBlurRamp,
  from: number,
  to: number,
  margin: number
): VisualBounds | null {
  const direction = { x: ramp.end.x - ramp.start.x, y: ramp.end.y - ramp.start.y }
  const lengthSquared = direction.x ** 2 + direction.y ** 2
  const along = (point: Vector) =>
    ((point.x - ramp.start.x) * direction.x + (point.y - ramp.start.y) * direction.y) /
    lengthSquared
  const slack = margin / Math.sqrt(lengthSquared)
  const bounds = ramp.bounds ?? {
    minX: -UNBOUNDED,
    minY: -UNBOUNDED,
    maxX: UNBOUNDED,
    maxY: UNBOUNDED
  }
  let polygon: Vector[] = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY }
  ]
  if (Number.isFinite(from))
    polygon = clipPolygon(polygon, (point) => along(point) - (from - slack))
  if (Number.isFinite(to)) polygon = clipPolygon(polygon, (point) => to + slack - along(point))
  if (polygon.length === 0) return null
  return {
    minX: Math.min(...polygon.map((point) => point.x)),
    minY: Math.min(...polygon.map((point) => point.y)),
    maxX: Math.max(...polygon.map((point) => point.x)),
    maxY: Math.max(...polygon.map((point) => point.y))
  }
}

/** CanvasKit could not make a step of a progressive blur. */
class ProgressiveBlurBuildError extends Error {
  override name = 'ProgressiveBlurBuildError'
}

/** One opaque white pixel per CanvasKit, stretched over a box to keep only what lies inside it. */
const cropImages = new WeakMap<CanvasKit, Image>()

function cropImage(ck: CanvasKit): Image {
  const kept = cropImages.get(ck)
  if (kept) return kept
  const image = ck.MakeImage(
    {
      width: 1,
      height: 1,
      alphaType: ck.AlphaType.Premul,
      colorType: ck.ColorType.RGBA_8888,
      colorSpace: ck.ColorSpace.SRGB
    },
    new Uint8Array([255, 255, 255, 255]),
    4
  )
  if (!image) throw new Error('CanvasKit could not make the progressive blur crop image')
  cropImages.set(ck, image)
  return image
}

/**
 * Figma's progressive blur: each pixel blurred by the sigma the ramp reaches at it, in two passes
 * as Figma blurs. Each pass mixes plain blurs at a few levels, weighted per pixel by a gradient
 * along the ramp, and each level blurs only its band of the ramp. A plain ramp (`isPlainRamp`) is
 * drawn as a plain blur instead. Null, with nothing left allocated, when CanvasKit cannot make a
 * step of it, so the layer draws unblurred rather than not at all.
 */
export function makeProgressiveBlur(
  ck: CanvasKit,
  ramp: ProgressiveBlurRamp,
  tile: TileMode
): ImageFilter | null {
  const levels = blurLevels(ramp.startSigma, ramp.endSigma)
  const stops = maskStops(levels, ramp.startSigma, ramp.endSigma)
  const weights = stops.map((t) =>
    levelWeights(levels, ramp.startSigma + (ramp.endSigma - ramp.startSigma) * t)
  )
  const made: ImageFilter[] = []
  // CanvasKit types its factories as always making a result, but a value it cannot use, such as a
  // sigma too large for a float, makes none.
  const keep = (filter: ImageFilter | null) => {
    if (!filter) throw new ProgressiveBlurBuildError()
    made.push(filter)
    return filter
  }
  const image = cropImage(ck)
  // Only what lies inside `box` survives, so a blur of it does no work outside the box.
  const crop = (input: ImageFilter | null, box: VisualBounds) => {
    const inside = keep(
      ck.ImageFilter.MakeImage(
        image,
        { filter: ck.FilterMode.Nearest },
        ck.LTRBRect(0, 0, 1, 1),
        ck.LTRBRect(box.minX, box.minY, box.maxX, box.maxY)
      )
    )
    return keep(ck.ImageFilter.MakeBlend(ck.BlendMode.DstIn, input, inside))
  }
  const masks: Shader[] = []
  // Each pass reads the image it is given, never another filter: Skia evaluates a filter input
  // once per use, so a second pass built on the first would redo the first for every level.
  const pass = (axis: 'x' | 'y'): ImageFilter => {
    let sum: ImageFilter | null = null
    for (const [level, sigma] of levels.entries()) {
      const [from, to] = levelBand(ramp, levels, level)
      const band = bandBox(ramp, from, to, 1)
      // Blurring reads this far past the band; a band with no content adds nothing.
      const reach = bandBox(ramp, from, to, 3 * sigma + 1)
      if (!band || !reach) continue
      const blurred =
        sigma > 0
          ? keep(
              ck.ImageFilter.MakeBlur(
                axis === 'x' ? sigma : 0,
                axis === 'y' ? sigma : 0,
                tile,
                crop(null, reach)
              )
            )
          : null
      const mask = crop(keep(ck.ImageFilter.MakeShader(masks[level])), band)
      const term = keep(ck.ImageFilter.MakeBlend(ck.BlendMode.DstIn, blurred, mask))
      sum = sum ? keep(ck.ImageFilter.MakeBlend(ck.BlendMode.Plus, sum, term)) : term
    }
    // No band holds any content: the pass leaves the image as it is.
    return sum ?? keep(ck.ImageFilter.MakeBlur(0, 0, tile, null))
  }
  // Figma blurs across the ramp first and along it second, so a pixel just past a steep ramp's
  // end gathers pixels blurred less than itself. Composed, the second pass takes the first's
  // result as its image, made once.
  const along =
    Math.abs(ramp.end.y - ramp.start.y) >= Math.abs(ramp.end.x - ramp.start.x) ? 'y' : 'x'
  let filter: ImageFilter | null = null
  try {
    for (const level of levels.keys()) {
      // Typed as always made; at runtime a point CanvasKit cannot use makes none.
      const mask = ck.Shader.MakeLinearGradient(
        [ramp.start.x, ramp.start.y],
        [ramp.end.x, ramp.end.y],
        weights.map((weight) => ck.Color4f(0, 0, 0, weight[level])),
        stops,
        ck.TileMode.Clamp
      ) as Shader | null
      if (!mask) throw new ProgressiveBlurBuildError()
      masks.push(mask)
    }
    filter = keep(ck.ImageFilter.MakeCompose(pass(along), pass(along === 'y' ? 'x' : 'y')))
    return filter
  } catch (error) {
    if (error instanceof ProgressiveBlurBuildError) return null
    throw error
  } finally {
    // Each filter holds what it is made from, so only the result is kept, and none on failure.
    for (const part of made) if (part !== filter) part.delete()
    for (const mask of masks) mask.delete()
  }
}
