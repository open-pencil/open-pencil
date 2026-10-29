import type { Canvas, ImageFilter, MaskFilter, Path } from 'canvaskit-wasm'

import { readEffectiveFigmaRawField } from '@open-pencil/fig'
import type { SceneNode } from '@open-pencil/scene-graph'
import type { Color, Vector } from '@open-pencil/scene-graph/primitives'

import { BLACK } from '#core/constants'

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

/**
 * Blurs what lies behind the layer, inside its outline, or inside `shape` when the layer's outline
 * is not its box, as with a boolean's result.
 */
export function applyClippedBlur(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  sigma: number,
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
  canvas.saveLayer(undefined, rect, r.getCachedBlur(sigma), undefined, r.ck.TileMode.Clamp)
  canvas.restore()
  // Exit guard: ensure shared paint is in clean state
  r.effectLayerPaint.setImageFilter(null)
  r.effectLayerPaint.setColorFilter(null)
  r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)
  canvas.restore()
}

const MAX_RAW_NOISE_CELLS = 12_000

interface RawNoiseEffect {
  type: 'NOISE'
  visible?: boolean
  color?: Color
  secondaryColor?: Color
  opacity?: number
  density?: number
  noiseSize?: Vector
  noiseType?: 'MONOTONE' | 'DUOTONE' | 'MULTITONE'
}

function rawNoiseEffects(node: SceneNode): RawNoiseEffect[] {
  const source = (node as Partial<SceneNode>).source
  const effects = source ? readEffectiveFigmaRawField(node, 'effects') : undefined
  if (!Array.isArray(effects)) return []
  return effects.filter(
    (effect): effect is RawNoiseEffect =>
      effect !== null &&
      typeof effect === 'object' &&
      'type' in effect &&
      effect.type === 'NOISE' &&
      ('visible' in effect ? effect.visible !== false : true)
  )
}

function seededNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function renderNoiseEffect(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  effect: RawNoiseEffect
): void {
  const density = Math.max(0, Math.min(1, effect.density ?? 0.3))
  const requestedStep = Math.max(2, Math.round((effect.noiseSize?.x ?? 0.5) * 8))
  const boundedStep = Math.ceil(Math.sqrt((node.width * node.height) / MAX_RAW_NOISE_CELLS))
  const step = Math.max(requestedStep, boundedStep)
  const color = effect.color ?? BLACK
  const opacity = effect.opacity ?? color.a
  const paint = new r.ck.Paint()
  try {
    paint.setAntiAlias(false)
    canvas.save()
    r.clipNodeShape(canvas, node)
    for (let y = 0; y < node.height; y += step) {
      for (let x = 0; x < node.width; x += step) {
        const value = seededNoise((x + 1) * 73856093 + (y + 1) * 19349663)
        if (value > density) continue
        const alpha = Math.max(0, Math.min(1, opacity * (0.35 + value * 0.65)))
        paint.setColor(r.ck.Color4f(color.r, color.g, color.b, alpha))
        canvas.drawRect(
          r.ck.LTRBRect(x, y, Math.min(node.width, x + 1), Math.min(node.height, y + 1)),
          paint
        )
      }
    }
    canvas.restore()
  } finally {
    paint.delete()
  }
}

/** Draws the raw Figma noise effects a node carries, which the scene graph does not model. */
export function renderNoiseEffects(r: SkiaRenderer, canvas: Canvas, node: SceneNode): void {
  for (const effect of rawNoiseEffects(node)) {
    renderNoiseEffect(r, canvas, node, effect)
  }
}
