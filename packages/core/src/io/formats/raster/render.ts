import type { CanvasKit, Canvas } from 'canvaskit-wasm'

import type { SkiaRenderer } from '#core/canvas'
import type { RenderColorSpace } from '#core/color/management'
import { computeContentBounds } from '#core/geometry'
import { extractExportGraph, findPageId } from '#core/io/subgraph'
import type { SceneGraph } from '#core/scene-graph'

export { computeContentBounds }

export type RasterExportFormat = 'PNG' | 'JPG' | 'WEBP'
export type ExportFormat = RasterExportFormat | 'SVG'

interface RenderOptions {
  scale: number
  format: ExportFormat
  quality?: number
  colorSpace?: RenderColorSpace
  trimTransparent?: boolean
}

function ensureSinglePageSelection(graph: SceneGraph, pageId: string, nodeIds: string[]): boolean {
  return nodeIds.every((nodeId) => findPageId(graph, nodeId) === pageId)
}

function nodeNeedsSceneBackdrop(graph: SceneGraph, nodeId: string): boolean {
  const node = graph.getNode(nodeId)
  if (!node) return false
  if (node.blendMode !== 'NORMAL' && node.blendMode !== 'PASS_THROUGH') return true
  if (node.effects.some((effect) => effect.visible && effect.type === 'BACKGROUND_BLUR')) {
    return true
  }
  return node.childIds.some((childId) => nodeNeedsSceneBackdrop(graph, childId))
}

function ckImageFormat(ck: CanvasKit, format: ExportFormat) {
  switch (format) {
    case 'JPG':
      return ck.ImageFormat.JPEG
    case 'WEBP':
      return ck.ImageFormat.WEBP
    default:
      return ck.ImageFormat.PNG
  }
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
): Uint8Array | null {
  const renderScale = 2
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
    image.delete()
    downsampleSurface.delete()
    ck.Free(downsamplePixels)
    return encoded ? new Uint8Array(encoded) : null
  } finally {
    surface.delete()
    ck.Free(pixels)
  }
}

export function renderNodesToImage(
  ck: CanvasKit,
  renderer: SkiaRenderer,
  graph: SceneGraph,
  pageId: string,
  nodeIds: string[],
  options: RenderOptions
): Uint8Array | null {
  if (!ensureSinglePageSelection(graph, pageId, nodeIds)) {
    throw new Error('Raster export selection must stay on a single page')
  }

  const bounds = computeContentBounds(graph, nodeIds)
  if (!bounds) return null

  const contentW = bounds.maxX - bounds.minX
  const contentH = bounds.maxY - bounds.minY
  if (contentW <= 0 || contentH <= 0) return null

  const pixelW = Math.ceil(contentW * options.scale)
  const pixelH = Math.ceil(contentH * options.scale)
  if (pixelW <= 0 || pixelH <= 0) return null

  const extracted = extractExportGraph(graph, { scope: 'selection', nodeIds })
  if (!extracted.pageId) return null

  const renderGraph = nodeIds.some((nodeId) => nodeNeedsSceneBackdrop(graph, nodeId))
    ? graph
    : extracted.graph
  const renderPageId = renderGraph === graph ? pageId : extracted.pageId

  const quality = options.quality ?? (options.format === 'PNG' ? 100 : 90)
  return renderToSurface(
    ck,
    renderer,
    renderGraph,
    renderPageId,
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

export function renderThumbnail(
  ck: CanvasKit,
  renderer: SkiaRenderer,
  graph: SceneGraph,
  pageId: string,
  width: number,
  height: number
): Uint8Array | null {
  const page = graph.getNode(pageId)
  if (!page || page.childIds.length === 0) return null

  const bounds = computeContentBounds(graph, page.childIds)
  if (!bounds) return null

  const contentW = bounds.maxX - bounds.minX
  const contentH = bounds.maxY - bounds.minY
  if (contentW <= 0 || contentH <= 0) return null

  const scale = Math.min(width / contentW, height / contentH, 2)

  return renderToSurface(ck, renderer, graph, pageId, width, height, 'PNG', 100, (canvas) => {
    canvas.clear(ck.Color4f(renderer.pageColor.r, renderer.pageColor.g, renderer.pageColor.b, 1))
    const offsetX = (width - contentW * scale) / 2 - bounds.minX * scale
    const offsetY = (height - contentH * scale) / 2 - bounds.minY * scale
    canvas.translate(offsetX, offsetY)
    canvas.scale(scale, scale)
  })
}
