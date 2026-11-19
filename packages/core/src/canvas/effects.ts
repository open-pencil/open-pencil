import type { Canvas, ImageFilter, MaskFilter, Path } from '@open-pencil/canvaskit'
import type { Effect, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { blurSigma, type VisualBounds } from '@open-pencil/scene-graph/geometry'
import { isLayerContainer } from '@open-pencil/scene-graph/node-defaults'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { ResourceCache } from '#core/cache/resource'

import { isPlainRamp, makeProgressiveBlur, progressiveBlurRamp } from './blur/progressive'
import { withNoiseEffects } from './noise/render'
import type { SkiaRenderer } from './renderer/skia'
import { withLeafTexture } from './texture/render'

/**
 * Filters a renderer keeps between frames, by their parameters: shadows and blurs reuse one across
 * every node and frame that shares them. Bounded, so a slider dragged through hundreds of values
 * frees the ones it passed rather than keeping them for the session.
 */
const MAX_CACHED_FILTERS = 256

export type ImageFilterCache = ResourceCache<string, ImageFilter>
export type MaskFilterCache = ResourceCache<number, MaskFilter>

export function createImageFilterCache(): ImageFilterCache {
  return new ResourceCache({ maxEntries: MAX_CACHED_FILTERS, dispose: (filter) => filter.delete() })
}

export function createMaskFilterCache(): MaskFilterCache {
  return new ResourceCache({ maxEntries: MAX_CACHED_FILTERS, dispose: (filter) => filter.delete() })
}

export function getCachedDropShadow(
  r: SkiaRenderer,
  dx: number,
  dy: number,
  sigma: number,
  color: Float32Array
): ImageFilter | null {
  const key = `ds:${dx},${dy},${sigma},${color[0]},${color[1]},${color[2]},${color[3]}`
  return cachedImageFilter(r, key, () =>
    r.ck.ImageFilter.MakeDropShadowOnly(dx, dy, sigma, sigma, color, null)
  )
}

export function getCachedBlur(r: SkiaRenderer, sigma: number): ImageFilter | null {
  return cachedImageFilter(r, `blur:${sigma}`, () =>
    r.ck.ImageFilter.MakeBlur(sigma, sigma, r.ck.TileMode.Clamp, null)
  )
}

export function getCachedDecalBlur(r: SkiaRenderer, sigma: number): ImageFilter | null {
  return cachedImageFilter(r, `dblur:${sigma}`, () =>
    r.ck.ImageFilter.MakeBlur(sigma, sigma, r.ck.TileMode.Decal, null)
  )
}

/**
 * The filter a layer or background blur draws with over a `width` × `height` layer: a plain blur,
 * or Figma's progressive one with its points mapped by `toFilter` into the filter's coordinates.
 * `bounds` holds what it blurs, in those coordinates, so each level blurs only its share.
 */
export function getCachedLayerBlur(
  r: SkiaRenderer,
  effect: Pick<Effect, 'radius' | 'progressive'>,
  width: number,
  height: number,
  bounds: VisualBounds | null,
  toFilter?: (point: Vector) => Vector
): ImageFilter | null {
  if (!effect.progressive) return r.getCachedBlur(blurSigma(effect.radius))
  const ramp = progressiveBlurRamp(
    effect.progressive,
    effect.radius,
    width,
    height,
    bounds,
    toFilter
  )
  if (isPlainRamp(ramp)) return r.getCachedBlur(ramp.endSigma)
  const box = bounds ? `${bounds.minX},${bounds.minY},${bounds.maxX},${bounds.maxY}` : 'unbounded'
  const key = `pblur:${ramp.start.x},${ramp.start.y},${ramp.end.x},${ramp.end.y},${ramp.startSigma},${ramp.endSigma}:${box}`
  return cachedImageFilter(r, key, () => makeProgressiveBlur(r.ck, ramp, r.ck.TileMode.Clamp))
}

/** CanvasKit makes no filter for a blur too small to draw; a paint takes null as none. */
export function getCachedMaskBlur(r: SkiaRenderer, sigma: number): MaskFilter | null {
  const cached = r.maskFilterCache.get(sigma)
  if (cached) return cached
  // Typed as always made; at runtime a sigma too small to blur makes none.
  const filter = r.ck.MaskFilter.MakeBlur(r.ck.BlurStyle.Normal, sigma, true) as MaskFilter | null
  if (filter) r.maskFilterCache.set(sigma, filter)
  return filter
}

function cachedImageFilter(
  r: SkiaRenderer,
  key: string,
  make: () => ImageFilter | null
): ImageFilter | null {
  const cached = r.imageFilterCache.get(key)
  if (cached) return cached
  const filter = make()
  if (filter) r.imageFilterCache.set(key, filter)
  return filter
}

/**
 * Blurs what lies behind the layer, inside its outline, or inside `shape` when the layer's outline
 * is not its box, as with a boolean's result.
 */
export function applyClippedBlur(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  effect: Pick<Effect, 'radius' | 'progressive'>,
  shape: Path | null = null
): void {
  const rect = r.ck.LTRBRect(0, 0, node.width, node.height)
  // Entry guard: reset shared paint to known state
  r.effectLayerPaint.setImageFilter(null)
  r.effectLayerPaint.setColorFilter(null)
  r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)

  canvas.save()
  if (shape) canvas.clipPath(shape, r.ck.ClipOp.Intersect, true)
  else r.clipNodeShape(canvas, node)
  const filter = r.getCachedLayerBlur(effect, node.width, node.height, {
    minX: 0,
    minY: 0,
    maxX: node.width,
    maxY: node.height
  })
  canvas.saveLayer(undefined, rect, filter, undefined, r.ck.TileMode.Clamp)
  canvas.restore()
  // Exit guard: ensure shared paint is in clean state
  r.effectLayerPaint.setImageFilter(null)
  r.effectLayerPaint.setColorFilter(null)
  r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)
  canvas.restore()
}

/**
 * Draws a shape or boolean with its own effects, as Figma layers them: shadows and background
 * blur behind, inner shadows over the fills and under the strokes (`paint` calls `inner` between
 * them), the texture roughening that content, and noise grains over it.
 */
export function renderLeafWithEffects(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph,
  paint: (inner: () => void) => void
): void {
  r.renderEffects(canvas, node, graph, 'behind')
  const content = () => paint(() => r.renderEffects(canvas, node, graph, 'inner'))
  const textured = () => withLeafTexture(r, canvas, node, content)
  // A frame or group grains its fill with its children, around both, in `renderNode`.
  if (isLayerContainer(node)) textured()
  else withNoiseEffects(r, canvas, node, graph, textured)
}
