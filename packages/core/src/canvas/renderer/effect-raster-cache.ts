import type { Canvas, Image as CKImage } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { arrowCapOverflow } from '@open-pencil/scene-graph/arrow-caps'

import { ResourceCache } from '#core/cache/resource'
import type { SkiaRenderer } from '#core/canvas/renderer'

export interface EffectRasterCacheEntry {
  image: CKImage
  left: number
  top: number
  width: number
  height: number
  scale: number
  pixels: number
  fontGeneration: number
}

const MAX_EFFECT_RASTER_CACHE_PIXELS = 24_000_000
const MAX_EFFECT_RASTER_ENTRY_PIXELS = 1_000_000
const MIN_EFFECT_RASTER_SCALE = 1
const MAX_EFFECT_RASTER_SCALE = 4
const EFFECT_RASTER_SCALE_STEP = 0.25
const MIN_REUSABLE_SCALE_RATIO = 0.85
const MAX_REUSABLE_SCALE_RATIO = 1.25

export class EffectRasterCache extends ResourceCache<string, EffectRasterCacheEntry> {
  constructor(maxPixels = MAX_EFFECT_RASTER_CACHE_PIXELS) {
    super({
      maxWeight: maxPixels,
      weight: (entry) => entry.pixels,
      dispose: (entry) => entry.image.delete()
    })
  }
}

export function effectRasterScale(targetScale: number): number {
  const quantized = Math.ceil(targetScale / EFFECT_RASTER_SCALE_STEP) * EFFECT_RASTER_SCALE_STEP
  return Math.min(MAX_EFFECT_RASTER_SCALE, Math.max(MIN_EFFECT_RASTER_SCALE, quantized))
}

export function effectRasterScaleMatches(cachedScale: number, targetScale: number): boolean {
  const ratio = cachedScale / targetScale
  return ratio >= MIN_REUSABLE_SCALE_RATIO && ratio <= MAX_REUSABLE_SCALE_RATIO
}

export function canCacheEffectRaster(width: number, height: number, scale: number): boolean {
  return (
    width > 0 &&
    height > 0 &&
    Math.ceil(width * scale) * Math.ceil(height * scale) <= MAX_EFFECT_RASTER_ENTRY_PIXELS
  )
}

function canRasterCacheEffects(visibleEffects: SceneNode['effects']): boolean {
  return (
    visibleEffects.length > 0 &&
    visibleEffects.every(
      (effect) => effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW'
    )
  )
}

/**
 * Draws a shape with effects from its cached raster or picture, recording one when there is
 * none: while the retained backing records, a shadowed shape rasterizes once at the current
 * scale; otherwise its drawing is kept as a picture.
 */
export function renderShapeThroughEffectCaches(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph,
  effects: SceneNode['effects']
): void {
  const canRasterCache = r.renderingSceneBacking && canRasterCacheEffects(effects)
  const targetScale = effectRasterScale(r.zoom * r.dpr)
  const cachedRaster = canRasterCache ? r.effectRasterCache.get(node.id) : null
  if (
    cachedRaster &&
    (cachedRaster.fontGeneration !== r.fontGeneration ||
      !effectRasterScaleMatches(cachedRaster.scale, targetScale))
  ) {
    r.effectRasterCache.delete(node.id)
  } else if (cachedRaster) {
    canvas.drawImageRectOptions(
      cachedRaster.image,
      r.ck.LTRBRect(0, 0, cachedRaster.image.width(), cachedRaster.image.height()),
      r.ck.LTRBRect(
        cachedRaster.left,
        cachedRaster.top,
        cachedRaster.left + cachedRaster.width,
        cachedRaster.top + cachedRaster.height
      ),
      r.ck.FilterMode.Linear,
      r.ck.MipmapMode.None,
      null
    )
    return
  }

  // An arrow head reaches past the shape, and its shadow reaches past the head: both margins.
  const margin =
    r.effectOverflow(node) + arrowCapOverflow(node.strokes, node.strokeCap, node.vectorNetwork)
  const width = node.width + margin * 2
  const height = node.height + margin * 2
  const scale = targetScale
  // A surface the GPU cannot give falls through to the picture path below.
  const surface =
    canRasterCache && canCacheEffectRaster(width, height, scale)
      ? r.surface.makeSurface({
          width: Math.ceil(width * scale),
          height: Math.ceil(height * scale),
          colorType: r.ck.ColorType.RGBA_8888,
          alphaType: r.ck.AlphaType.Premul,
          colorSpace: r.ck.ColorSpace.SRGB
        })
      : null
  if (surface) {
    const rasterCanvas = surface.getCanvas()
    try {
      rasterCanvas.clear(r.ck.TRANSPARENT)
      rasterCanvas.scale(scale, scale)
      rasterCanvas.translate(margin, margin)
      r.renderShapeUncached(rasterCanvas, node, graph)
      surface.flush()
      const image = surface.makeImageSnapshot()
      const retained = r.effectRasterCache.set(node.id, {
        image,
        left: -margin,
        top: -margin,
        width,
        height,
        scale,
        pixels: image.width() * image.height(),
        fontGeneration: r.fontGeneration
      })
      try {
        canvas.drawImageRectOptions(
          image,
          r.ck.LTRBRect(0, 0, image.width(), image.height()),
          r.ck.LTRBRect(-margin, -margin, node.width + margin, node.height + margin),
          r.ck.FilterMode.Linear,
          r.ck.MipmapMode.None,
          null
        )
      } finally {
        if (!retained) image.delete()
      }
      return
    } finally {
      surface.delete()
    }
  }

  const cached = r.nodePictureCache.get(node.id)
  const cachedGeneration = r.nodePictureCacheGenerations.get(node.id)
  if (cached && cachedGeneration === r.fontGeneration) {
    canvas.drawPicture(cached)
    return
  }
  if (cached) cached.delete()
  r.nodePictureCache.delete(node.id)
  r.nodePictureCacheGenerations.delete(node.id)

  const bounds = r.ck.LTRBRect(-margin, -margin, node.width + margin, node.height + margin)
  const recorder = new r.ck.PictureRecorder()
  try {
    const recCanvas = recorder.beginRecording(bounds)
    r.renderShapeUncached(recCanvas, node, graph)
    const picture = recorder.finishRecordingAsPicture()
    r.nodePictureCache.set(node.id, picture)
    r.nodePictureCacheGenerations.set(node.id, r.fontGeneration)
    canvas.drawPicture(picture)
  } finally {
    recorder.delete()
  }
}
