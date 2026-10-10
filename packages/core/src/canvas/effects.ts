import type { Canvas, ImageFilter, MaskFilter } from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from './renderer'

/**
 * The Gaussian sigma that draws a Figma blur radius as Figma does. Measured on Figma 126 exports,
 * layer blur, both shadows, and background blur fall off as a Gaussian of 0.43 × radius; Figma's
 * SVG export writes radius / 2, which is wider (`packages/core/tests/canvas/blur.test.ts`).
 */
export function blurSigma(radius: number): number {
  return radius * 0.43
}

export function getCachedDropShadow(
  r: SkiaRenderer,
  dx: number,
  dy: number,
  sigma: number,
  color: Float32Array
): ImageFilter {
  const key = `ds:${dx},${dy},${sigma},${color[0]},${color[1]},${color[2]},${color[3]}`
  let filter = r.imageFilterCache.get(key)
  if (!filter) {
    filter = r.ck.ImageFilter.MakeDropShadowOnly(dx, dy, sigma, sigma, color, null)
    r.imageFilterCache.set(key, filter)
  }
  return filter
}

export function getCachedBlur(r: SkiaRenderer, sigma: number): ImageFilter {
  const key = `blur:${sigma}`
  let filter = r.imageFilterCache.get(key)
  if (!filter) {
    filter = r.ck.ImageFilter.MakeBlur(sigma, sigma, r.ck.TileMode.Clamp, null)
    r.imageFilterCache.set(key, filter)
  }
  return filter
}

export function getCachedDecalBlur(r: SkiaRenderer, sigma: number): ImageFilter {
  const key = `dblur:${sigma}`
  let filter = r.imageFilterCache.get(key)
  if (!filter) {
    filter = r.ck.ImageFilter.MakeBlur(sigma, sigma, r.ck.TileMode.Decal, null)
    r.imageFilterCache.set(key, filter)
  }
  return filter
}

export function getCachedMaskBlur(r: SkiaRenderer, sigma: number): MaskFilter {
  let filter = r.maskFilterCache.get(sigma)
  if (!filter) {
    filter = r.ck.MaskFilter.MakeBlur(r.ck.BlurStyle.Normal, sigma, true)
    r.maskFilterCache.set(sigma, filter)
  }
  return filter
}

export function applyClippedBlur(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rect: Float32Array,
  hasRadius: boolean,
  sigma: number
): void {
  // Entry guard: reset shared paint to known state
  r.effectLayerPaint.setImageFilter(null)
  r.effectLayerPaint.setColorFilter(null)
  r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)

  canvas.save()
  r.clipNodeShape(canvas, node, rect, hasRadius)
  canvas.saveLayer(undefined, rect, r.getCachedBlur(sigma), undefined, r.ck.TileMode.Clamp)
  canvas.restore()
  // Exit guard: ensure shared paint is in clean state
  r.effectLayerPaint.setImageFilter(null)
  r.effectLayerPaint.setColorFilter(null)
  r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)
  canvas.restore()
}
