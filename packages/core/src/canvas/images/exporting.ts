import type { Image } from '@open-pencil/canvaskit'
import type { ImageFilters, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import Matrix from '@open-pencil/scene-graph/matrix'

import type { SkiaRenderer } from '#core/canvas/renderer/skia'

import { adjustmentValues } from './adjustments'
import { bakeFromPalette, holdsEightBitChannels, paletteOf, withSourcePixels } from './baked'
import type { ExportImages, ExportSource, ExportTarget, RendererImages } from './state'

const SOURCE_PIXELS_PER_SHADER_RUN = 100

function drawingOn<T>(exporting: ExportImages, target: ExportTarget | null, draw: () => T): T {
  if (!target) {
    return draw()
  }
  const outer = exporting.target
  exporting.target = target
  try {
    return draw()
  } finally {
    exporting.target = outer
  }
}

export function drawingExport<T>(
  images: RendererImages,
  target: ExportTarget | null,
  draw: () => T
): T {
  const open = images.exporting
  if (open) {
    return drawingOn(open, target, draw)
  }
  const exporting: ExportImages = { adjusted: new Map(), sources: new Map(), target: null }
  images.exporting = exporting
  try {
    return drawingOn(exporting, target, draw)
  } finally {
    images.exporting = null
    for (const image of exporting.adjusted.values()) {
      image?.delete()
    }
  }
}

function coveredRasterPixels(target: ExportTarget | null, node: SceneNode): number {
  if (!target) {
    return Number.POSITIVE_INFINITY
  }
  const { width, height } = node
  const corners = Matrix.mapPoints(target.canvas.getTotalMatrix(), [
    0,
    0,
    width,
    0,
    width,
    height,
    0,
    height
  ])
  const [x0, y0, x1, y1, x2, y2, x3, y3] = corners
  const [clipLeft, clipTop, clipRight, clipBottom] = target.canvas.getDeviceClipBounds()
  const coveredWidth =
    Math.min(clipRight, Math.max(x0, x1, x2, x3)) - Math.max(clipLeft, Math.min(x0, x1, x2, x3))
  const coveredHeight =
    Math.min(clipBottom, Math.max(y0, y1, y2, y3)) - Math.max(clipTop, Math.min(y0, y1, y2, y3))
  const covered =
    Math.max(0, coveredWidth) * Math.max(0, coveredHeight) * target.rasterPixelsPerDeviceUnit ** 2
  return Number.isNaN(covered) ? Number.POSITIVE_INFINITY : covered
}

function describeSource(r: SkiaRenderer, image: Image): ExportSource {
  return {
    width: image.width(),
    height: image.height(),
    bakesExactly: holdsEightBitChannels(r, image),
    distinctColors: null
  }
}

export function shaderIsCheaper(source: ExportSource, coveredPixels: number): boolean {
  if (!source.bakesExactly) {
    return true
  }
  const sourcePixels = source.width * source.height
  if (sourcePixels <= coveredPixels) {
    return false
  }
  if (source.distinctColors === null) {
    return false
  }
  const bakeCost = source.distinctColors + sourcePixels / SOURCE_PIXELS_PER_SHADER_RUN
  return bakeCost >= coveredPixels
}

function withStoredImage(
  r: SkiaRenderer,
  graph: SceneGraph,
  hash: string,
  use: (image: Image) => Image | null
): Image | null {
  const cached = r.images.cache.get(hash)
  if (cached) {
    return use(cached)
  }
  const data = graph.images.get(hash)
  const decoded = data && r.ck.MakeImageFromEncoded(data)
  if (!decoded) {
    return null
  }
  try {
    return use(decoded)
  } finally {
    decoded.delete()
  }
}

function bakedImageKey(hash: string, filters: ImageFilters): string {
  return `${hash}:${Object.values(adjustmentValues(filters)).join(',')}`
}

function bakeUnlessShaderIsCheaper(
  r: SkiaRenderer,
  exporting: ExportImages,
  image: Image,
  draw: { hash: string; filters: ImageFilters; coveredPixels: number }
): Image | null {
  const source = exporting.sources.get(draw.hash) ?? describeSource(r, image)
  exporting.sources.set(draw.hash, source)
  if (shaderIsCheaper(source, draw.coveredPixels)) {
    return null
  }
  return withSourcePixels(r, image, (pixels) => {
    const palette = paletteOf(pixels.pixels)
    source.distinctColors = palette.count
    if (shaderIsCheaper(source, draw.coveredPixels)) {
      return null
    }
    const baked = bakeFromPalette(r, pixels, palette, draw.filters)
    exporting.adjusted.set(bakedImageKey(draw.hash, draw.filters), baked)
    return baked
  })
}

export function adjustedImageForExport(
  r: SkiaRenderer,
  graph: SceneGraph,
  hash: string,
  filters: ImageFilters,
  node: SceneNode
): Image | null {
  const exporting = r.images.exporting
  if (!exporting) {
    return null
  }
  const kept = exporting.adjusted.get(bakedImageKey(hash, filters))
  if (kept !== undefined) {
    return kept
  }
  const coveredPixels = coveredRasterPixels(exporting.target, node)
  const known = exporting.sources.get(hash)
  if (known && shaderIsCheaper(known, coveredPixels)) {
    return null
  }
  return withStoredImage(r, graph, hash, (image) =>
    bakeUnlessShaderIsCheaper(r, exporting, image, { hash, filters, coveredPixels })
  )
}
