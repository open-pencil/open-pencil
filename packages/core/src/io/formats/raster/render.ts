import type { CanvasKit, Canvas } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { RenderColorSpace } from '@open-pencil/scene-graph/color'
import { getAxisAlignedWorldBounds, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import { unionVisualBounds, type VisualBounds } from '@open-pencil/scene-graph/geometry'
import type { Mat3 } from '@open-pencil/scene-graph/matrix'

import type { SkiaRenderer } from '#core/canvas'
import { computeContentBounds } from '#core/canvas/renderer/visual-bounds'
import { getPageColor } from '#core/figma-api/page-backgrounds'
import { extractExportGraph, findPageId } from '#core/io/subgraph'

import { ckImageFormat } from './pixels'

export type RasterExportFormat = 'PNG' | 'JPG' | 'WEBP'
export type ExportFormat = RasterExportFormat | 'SVG'

interface RenderOptions {
  scale: number
  format: ExportFormat
  quality?: number
  colorSpace?: RenderColorSpace
  trimTransparent?: boolean
  /** Crop to the layers' boxes rather than to everything they draw, as Figma can for text. */
  useAbsoluteBounds?: boolean
}

/**
 * The most pixels a raster export holds: 8192 by 8192, 256 MB of RGBA. Larger images would
 * exhaust the renderer's memory, so they are refused rather than attempted.
 */
export const MAX_RASTER_PIXELS = 8192 * 8192

/** Exports up to this size are drawn at twice their size and scaled down, for smoother edges. */
const SUPERSAMPLE = 2

/** The pixel size of `bounds` exported at `scale`. */
export function rasterSize(bounds: VisualBounds, scale: number): { width: number; height: number } {
  return {
    width: Math.ceil((bounds.maxX - bounds.minX) * scale),
    height: Math.ceil((bounds.maxY - bounds.minY) * scale)
  }
}

/** Why an image of `width` by `height` pixels is too big to export, or null when it is not. */
export function oversizedRaster(width: number, height: number): string | null {
  if (width * height <= MAX_RASTER_PIXELS) return null
  return `An image can hold at most ${MAX_RASTER_PIXELS} pixels; this one would be ${width} by ${height}`
}

function ensureSinglePageSelection(graph: SceneGraph, pageId: string, nodeIds: string[]): boolean {
  return nodeIds.every((nodeId) => findPageId(graph, nodeId) === pageId)
}

/**
 * What an export of `nodeIds` covers: everything they draw, or with `useAbsoluteBounds` their
 * boxes alone; null when nothing is visible.
 */
export function exportBounds(
  graph: SceneGraph,
  nodeIds: string[],
  useAbsoluteBounds = false
): VisualBounds | null {
  if (!useAbsoluteBounds) return computeContentBounds(graph, nodeIds)
  let bounds: VisualBounds | null = null
  for (const id of nodeIds) {
    const node = graph.getNode(id)
    if (!node?.visible) continue
    const { x, y, width, height } = getAxisAlignedWorldBounds(node, graph)
    bounds = unionVisualBounds(bounds, { minX: x, minY: y, maxX: x + width, maxY: y + height })
  }
  return bounds
}

function findAlphaBounds(ck: CanvasKit, canvas: Canvas, width: number, height: number) {
  const pixels = canvas.readPixels(0, 0, {
    alphaType: ck.AlphaType.Unpremul,
    colorType: ck.ColorType.RGBA_8888,
    colorSpace: ck.ColorSpace.SRGB,
    width,
    height
  })
  if (!pixels) return null

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y++) {
    const row = y * width * 4
    for (let x = 0; x < width; x++) {
      if (pixels[row + x * 4 + 3] === 0) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + 1)
      maxY = Math.max(maxY, y + 1)
    }
  }

  if (maxX < minX || maxY < minY) return null
  return { minX, minY, maxX, maxY }
}

const MIN_TRANSPARENT_TRIM_INSET = 2

function shouldTrimAlphaBounds(
  alphaBounds: NonNullable<ReturnType<typeof findAlphaBounds>>,
  width: number,
  height: number
): boolean {
  return (
    Math.max(
      alphaBounds.minX,
      alphaBounds.minY,
      width - alphaBounds.maxX,
      height - alphaBounds.maxY
    ) >= MIN_TRANSPARENT_TRIM_INSET
  )
}

function renderToSurface(
  ck: CanvasKit,
  renderer: SkiaRenderer,
  renderGraph: SceneGraph,
  pageId: string,
  width: number,
  height: number,
  format: ExportFormat,
  quality: number,
  setup: (canvas: Canvas) => void,
  trimTransparent = false
): Uint8Array<ArrayBuffer> | null {
  const oversized = oversizedRaster(width, height)
  if (oversized) throw new RangeError(oversized)
  const renderScale =
    width * height * SUPERSAMPLE * SUPERSAMPLE <= MAX_RASTER_PIXELS ? SUPERSAMPLE : 1
  const renderWidth = width * renderScale
  const renderHeight = height * renderScale
  const pixels = ck.Malloc(Uint8Array, renderWidth * renderHeight * 4)
  const surface = ck.MakeRasterDirectSurface(
    {
      alphaType: ck.AlphaType.Premul,
      colorType: ck.ColorType.RGBA_8888,
      colorSpace: ck.ColorSpace.SRGB,
      width: renderWidth,
      height: renderHeight
    },
    pixels,
    renderWidth * 4
  )
  if (!surface) {
    ck.Free(pixels)
    return null
  }

  try {
    const canvas = surface.getCanvas()
    canvas.scale(renderScale, renderScale)
    setup(canvas)
    renderer.renderSceneToCanvas(canvas, renderGraph, pageId)
    surface.flush()

    const highResImage = surface.makeImageSnapshot()
    const downsamplePixels = ck.Malloc(Uint8Array, width * height * 4)
    const downsampleSurface = ck.MakeRasterDirectSurface(
      {
        alphaType: ck.AlphaType.Premul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB,
        width,
        height
      },
      downsamplePixels,
      width * 4
    )
    if (!downsampleSurface) {
      ck.Free(downsamplePixels)
      highResImage.delete()
      return null
    }
    const downsampleCanvas = downsampleSurface.getCanvas()
    downsampleCanvas.clear(ck.TRANSPARENT)
    downsampleCanvas.drawImageRectOptions(
      highResImage,
      ck.LTRBRect(0, 0, renderWidth, renderHeight),
      ck.LTRBRect(0, 0, width, height),
      ck.FilterMode.Linear,
      ck.MipmapMode.None,
      null
    )
    downsampleSurface.flush()
    highResImage.delete()

    const foundAlphaBounds = trimTransparent
      ? findAlphaBounds(ck, downsampleCanvas, width, height)
      : null
    const alphaBounds =
      foundAlphaBounds && shouldTrimAlphaBounds(foundAlphaBounds, width, height)
        ? foundAlphaBounds
        : null
    const image = alphaBounds
      ? downsampleSurface.makeImageSnapshot([
          alphaBounds.minX,
          alphaBounds.minY,
          alphaBounds.maxX,
          alphaBounds.maxY
        ])
      : downsampleSurface.makeImageSnapshot()
    const encoded = image.encodeToBytes(ckImageFormat(ck, format), quality)
    const resultBytes = encoded ? new Uint8Array(encoded) : null

    image.delete()
    downsampleSurface.delete()
    ck.Free(downsamplePixels)
    return resultBytes
  } finally {
    surface.delete()
    ck.Free(pixels)
  }
}

/**
 * `nodeIds` in the order the source page paints them, bottom to top, whatever order they came in,
 * without those a selected ancestor already paints.
 */
function inPaintOrder(source: SceneGraph, pageId: string, nodeIds: readonly string[]): string[] {
  const selected = new Set(nodeIds)
  const ordered: string[] = []
  const visit = (id: string): void => {
    if (selected.has(id)) {
      ordered.push(id)
      return
    }
    for (const childId of source.getNode(id)?.childIds ?? []) visit(childId)
  }
  visit(pageId)
  return ordered
}

export function prepareSelectionRenderGraph(
  source: SceneGraph,
  renderGraph: SceneGraph,
  pageId: string,
  nodeIds: string[]
): void {
  const page = renderGraph.getNode(pageId)
  if (!page) return

  page.childIds = inPaintOrder(source, pageId, nodeIds).filter(
    (nodeId) => renderGraph.getNode(nodeId) !== undefined
  )
  for (const nodeId of page.childIds) {
    const node = renderGraph.getNode(nodeId)
    const sourceNode = source.getNode(nodeId)
    if (!node || !sourceNode) continue
    if (sourceNode.parentId === pageId) continue
    const world = getWorldMatrix(sourceNode, source)
    node.parentId = pageId
    applyWorldTransform(node, world)
  }
  renderGraph.clearAbsPosCache()
}

function applyWorldTransform(node: SceneNode, matrix: Mat3): void {
  const determinant = matrix[0] * matrix[4] - matrix[1] * matrix[3]
  const flipX = determinant < 0
  const rotation = Math.atan2(matrix[3], flipX ? matrix[4] : matrix[0])
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const centerX = node.width / 2
  const centerY = node.height / 2
  const m00 = flipX ? -cos : cos
  const m01 = flipX ? sin : -sin
  const m10 = sin
  const m11 = cos

  node.x = matrix[2] - centerX + m00 * centerX + m01 * centerY
  node.y = matrix[5] - centerY + m10 * centerX + m11 * centerY
  node.rotation = rotation * (180 / Math.PI)
  node.flipX = flipX
  node.flipY = false
}

export function renderNodesToImage(
  ck: CanvasKit,
  renderer: SkiaRenderer,
  graph: SceneGraph,
  pageId: string,
  nodeIds: string[],
  options: RenderOptions
): Uint8Array<ArrayBuffer> | null {
  if (!ensureSinglePageSelection(graph, pageId, nodeIds)) {
    throw new Error('Raster export selection must stay on a single page')
  }

  const bounds = exportBounds(graph, nodeIds, options.useAbsoluteBounds)
  if (!bounds) return null

  const contentW = bounds.maxX - bounds.minX
  const contentH = bounds.maxY - bounds.minY
  if (contentW <= 0 || contentH <= 0) return null

  const { width: pixelW, height: pixelH } = rasterSize(bounds, options.scale)
  if (pixelW <= 0 || pixelH <= 0) return null

  // Figma exports a layer by itself, without the page behind it, even when it blends.
  const extracted = extractExportGraph(graph, { scope: 'selection', nodeIds })
  if (!extracted.pageId) return null
  prepareSelectionRenderGraph(graph, extracted.graph, extracted.pageId, nodeIds)

  const quality = options.quality ?? (options.format === 'PNG' ? 100 : 90)
  return renderToSurface(
    ck,
    renderer,
    extracted.graph,
    extracted.pageId,
    pixelW,
    pixelH,
    options.format,
    quality,
    (canvas) => {
      canvas.clear(ck.TRANSPARENT)
      canvas.scale(options.scale, options.scale)
      canvas.translate(-bounds.minX, -bounds.minY)
    },
    options.trimTransparent
  )
}

export interface ThumbnailFrame {
  /** The page content the thumbnail shows. */
  bounds: VisualBounds
  scale: number
  /** The thumbnail's size in pixels. */
  width: number
  height: number
}

/**
 * How a thumbnail frames its page's content, always whole: `contain` is as large as the content
 * fits in `width` by `height`, and `letterbox` is exactly that size with the content centred on
 * the page colour, as Figma's file browser shows a file in its card.
 */
export type ThumbnailFit = 'contain' | 'letterbox'

/** The page region a thumbnail of `width` by `height` pixels shows, and its size. */
export function thumbnailFrame(
  graph: SceneGraph,
  pageId: string,
  width: number,
  height: number,
  fit: ThumbnailFit = 'contain'
): ThumbnailFrame | null {
  const page = graph.getNode(pageId)
  if (!page || page.childIds.length === 0) return null

  const bounds = computeContentBounds(graph, page.childIds)
  if (!bounds) return null

  const contentW = bounds.maxX - bounds.minX
  const contentH = bounds.maxY - bounds.minY
  if (contentW <= 0 || contentH <= 0) return null

  const scale = Math.min(width / contentW, height / contentH)
  if (fit === 'letterbox') {
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2
    const halfW = width / scale / 2
    const halfH = height / scale / 2
    return {
      bounds: {
        minX: centerX - halfW,
        minY: centerY - halfH,
        maxX: centerX + halfW,
        maxY: centerY + halfH
      },
      scale,
      width,
      height
    }
  }

  return {
    bounds,
    scale,
    width: Math.max(1, Math.round(contentW * scale)),
    height: Math.max(1, Math.round(contentH * scale))
  }
}

export function renderThumbnail(
  ck: CanvasKit,
  renderer: SkiaRenderer,
  graph: SceneGraph,
  pageId: string,
  width: number,
  height: number,
  fit: ThumbnailFit = 'contain'
): Uint8Array<ArrayBuffer> | null {
  const frame = thumbnailFrame(graph, pageId, width, height, fit)
  if (!frame) return null
  const { bounds, scale, width: pixelW, height: pixelH } = frame
  // The page's own background, which the editor's page colour matches only while it is open.
  const background = getPageColor(graph.getNode(pageId))

  return renderToSurface(ck, renderer, graph, pageId, pixelW, pixelH, 'PNG', 100, (canvas) => {
    canvas.clear(ck.Color4f(background.r, background.g, background.b, 1))
    canvas.translate(-bounds.minX * scale, -bounds.minY * scale)
    canvas.scale(scale, scale)
  })
}

/** Draws a page region with `renderer`; `region.ts` gives it a renderer of its own. */
export function drawRegionToImage(
  ck: CanvasKit,
  renderer: SkiaRenderer,
  graph: SceneGraph,
  pageId: string,
  bounds: VisualBounds,
  scale: number
): Uint8Array<ArrayBuffer> | null {
  const pixelW = Math.max(1, Math.round((bounds.maxX - bounds.minX) * scale))
  const pixelH = Math.max(1, Math.round((bounds.maxY - bounds.minY) * scale))
  if (!graph.getNode(pageId) || !Number.isFinite(pixelW * pixelH)) return null
  return renderToSurface(ck, renderer, graph, pageId, pixelW, pixelH, 'PNG', 100, (canvas) => {
    canvas.clear(ck.Color4f(renderer.pageColor.r, renderer.pageColor.g, renderer.pageColor.b, 1))
    canvas.scale(scale, scale)
    canvas.translate(-bounds.minX, -bounds.minY)
  })
}
