import type { Canvas, Image } from '@open-pencil/canvaskit'
import type { ImageFilters, SceneNode, Stroke } from '@open-pencil/scene-graph'

import { ResourceCache } from '#core/cache/resource'
import type { SkiaRenderer } from '#core/canvas/renderer/skia'

import { adjustmentValues } from './adjustments'
import {
  bakeFromScan,
  holdsEightBitChannels,
  releaseScan,
  scanByteLength,
  scanSource,
  type SourceScan
} from './baked'
import { IMAGE_CACHE_BYTES } from './cache'
import { areaScale, coveredRasterPixels, shaderIsCheaper } from './export-cost'
import type { ExportImages, ExportSource, ExportTarget, RendererImages } from './state'

const SCANS_BYTES = IMAGE_CACHE_BYTES / 2
const MAX_SCANS = 64

export interface AdjustedImageDraw {
  readonly hash: string
  readonly filters: ImageFilters
  readonly node: SceneNode
  readonly stroke?: Stroke
}

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

function openExport(): ExportImages {
  return {
    adjusted: new Map(),
    sources: new Map(),
    scans: new ResourceCache({
      maxEntries: MAX_SCANS,
      maxWeight: SCANS_BYTES,
      weight: scanByteLength,
      dispose: releaseScan
    }),
    target: null
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
  const exporting = openExport()
  images.exporting = exporting
  try {
    return drawingOn(exporting, target, draw)
  } finally {
    images.exporting = null
    exporting.scans.clear()
    for (const image of exporting.adjusted.values()) {
      image?.delete()
    }
  }
}

export function drawingPictureRasterizedByExport<T>(
  images: RendererImages,
  recording: Canvas,
  draw: () => T
): T {
  const outer = images.exporting?.target
  if (!outer) {
    return draw()
  }
  const outerScale = Math.sqrt(areaScale(outer.canvas.getTotalMatrix()))
  const target = {
    canvas: recording,
    rasterPixelsPerDeviceUnit: outer.rasterPixelsPerDeviceUnit * outerScale
  }
  return drawingExport(images, target, draw)
}

function describeSource(r: SkiaRenderer, image: Image): ExportSource {
  return {
    width: image.width(),
    height: image.height(),
    bakesExactly: holdsEightBitChannels(r, image),
    distinctColors: null
  }
}

function withScan<T>(
  r: SkiaRenderer,
  exporting: ExportImages,
  hash: string,
  image: Image,
  use: (scan: SourceScan) => T
): T | null {
  const kept = exporting.scans.get(hash)
  if (kept) {
    return use(kept)
  }
  const scan = scanSource(r, image)
  if (!scan) {
    return null
  }
  if (exporting.scans.set(hash, scan)) {
    return use(scan)
  }
  try {
    return use(scan)
  } finally {
    releaseScan(scan)
  }
}

function bakedImageKey(hash: string, filters: ImageFilters): string {
  return `${hash}:${Object.values(adjustmentValues(filters)).join(',')}`
}

export function adjustedImageForExport(
  r: SkiaRenderer,
  draw: AdjustedImageDraw,
  storedImage: () => Image | null
): Image | null {
  const exporting = r.images.exporting
  if (!exporting) {
    return null
  }
  const key = bakedImageKey(draw.hash, draw.filters)
  const kept = exporting.adjusted.get(key)
  if (kept !== undefined) {
    return kept
  }
  const coveredPixels = coveredRasterPixels(exporting.target, draw.node, draw.stroke)
  const known = exporting.sources.get(draw.hash)
  if (known && shaderIsCheaper(known, coveredPixels)) {
    return null
  }
  const image = storedImage()
  if (!image) {
    return null
  }
  const source = known ?? describeSource(r, image)
  exporting.sources.set(draw.hash, source)
  if (shaderIsCheaper(source, coveredPixels)) {
    return null
  }
  return withScan(r, exporting, draw.hash, image, (scan) => {
    source.distinctColors = scan.palette.count
    if (shaderIsCheaper(source, coveredPixels)) {
      return null
    }
    const baked = bakeFromScan(r, scan, draw.filters)
    exporting.adjusted.set(key, baked)
    return baked
  })
}
