import type { CanvasKit, Canvas, MallocObj, Surface } from 'canvaskit-wasm'

import { readStoredPageColor } from '@open-pencil/fig'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { computeDescendantVisualBounds } from '@open-pencil/scene-graph/geometry'

import type { SkiaRenderer } from '#core/canvas'
import type { RenderColorSpace } from '#core/color/management'
import { startRasterProfile } from '#core/io/formats/raster/profile'
import { extractExportGraph, findPageId } from '#core/io/subgraph'

export type RasterExportFormat = 'PNG' | 'JPG' | 'WEBP'
export type ExportFormat = RasterExportFormat | 'SVG'

interface RenderOptions {
  scale: number
  format: ExportFormat
  quality?: number
  colorSpace?: RenderColorSpace
  trimTransparent?: boolean
  /**
   * Draw at twice the requested size and downsample, for smoother edges.
   *
   * On by default because exports are looked at closely. It costs four times the pixels,
   * a second full-size buffer and an extra image copy, so callers rendering for immediate
   * display — where the raster is already at device resolution — should turn it off.
   */
  supersample?: boolean
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

export function computeContentBounds(graph: SceneGraph, nodeIds: string[]) {
  return computeDescendantVisualBounds(
    nodeIds,
    (id) => graph.getNode(id),
    (id) => graph.getAbsolutePosition(id)
  )
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

type AlphaBounds = NonNullable<ReturnType<typeof findAlphaBounds>>

function shouldTrimAlphaBounds(alphaBounds: AlphaBounds, width: number, height: number): boolean {
  return (
    Math.max(
      alphaBounds.minX,
      alphaBounds.minY,
      width - alphaBounds.maxX,
      height - alphaBounds.maxY
    ) >= MIN_TRANSPARENT_TRIM_INSET
  )
}

function trimmedAlphaBounds(
  ck: CanvasKit,
  canvas: Canvas,
  width: number,
  height: number,
  trimTransparent: boolean
): AlphaBounds | null {
  if (!trimTransparent) return null
  const found = findAlphaBounds(ck, canvas, width, height)
  return found && shouldTrimAlphaBounds(found, width, height) ? found : null
}

function encodeSurfaceImage(
  ck: CanvasKit,
  renderer: SkiaRenderer,
  surface: Surface,
  canvas: Canvas,
  width: number,
  height: number,
  format: ExportFormat,
  quality: number,
  alphaBounds: AlphaBounds | null
): Uint8Array | null {
  const image = alphaBounds
    ? surface.makeImageSnapshot([
        alphaBounds.minX,
        alphaBounds.minY,
        alphaBounds.maxX,
        alphaBounds.maxY
      ])
    : surface.makeImageSnapshot()

  try {
    const encoded = image.encodeToBytes(ckImageFormat(ck, format), quality)
    if (encoded) return new Uint8Array(encoded)

    // CanvasKit's `encodeToBytes` returns null for JPEG/WEBP in this build, so
    // fall back to encoding the raw pixels through the browser canvas.
    if (format !== 'JPG' && format !== 'WEBP') return null
    const exportWidth = alphaBounds ? alphaBounds.maxX - alphaBounds.minX : width
    const exportHeight = alphaBounds ? alphaBounds.maxY - alphaBounds.minY : height
    const exportMinX = alphaBounds?.minX ?? 0
    const exportMinY = alphaBounds?.minY ?? 0
    const rawPixels = canvas.readPixels(exportMinX, exportMinY, {
      alphaType: ck.AlphaType.Unpremul,
      colorType: ck.ColorType.RGBA_8888,
      colorSpace: ck.ColorSpace.SRGB,
      width: exportWidth,
      height: exportHeight
    })
    if (!(rawPixels instanceof Uint8Array)) return null
    return renderer.encodeRasterFallback(rawPixels, exportWidth, exportHeight, format, quality)
  } finally {
    image.delete()
  }
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
  supersample: boolean,
  setup: (canvas: Canvas) => void,
  trimTransparent = false
): Uint8Array | null {
  const renderScale = supersample ? 2 : 1
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

  const inner = startRasterProfile('renderToSurface')
  try {
    inner.phase('draw')
    const canvas = surface.getCanvas()
    canvas.scale(renderScale, renderScale)
    setup(canvas)
    renderer.renderSceneToCanvas(canvas, renderGraph, pageId)
    surface.flush()

    // Without supersampling the surface is already the requested size, so the snapshot,
    // the second buffer and the copy between them are all pure cost and are skipped.
    inner.phase('downsample')
    const downsamplePixels = renderScale === 1 ? null : ck.Malloc(Uint8Array, width * height * 4)
    const downsampleSurface = downsamplePixels
      ? ck.MakeRasterDirectSurface(
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
      : surface
    if (!downsampleSurface) {
      if (downsamplePixels) ck.Free(downsamplePixels)
      return null
    }
    try {
      const downsampleCanvas = downsampleSurface.getCanvas()
      if (downsamplePixels) {
        const highResImage = surface.makeImageSnapshot()
        try {
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
        } finally {
          highResImage.delete()
        }
      }

      const alphaBounds = trimmedAlphaBounds(ck, downsampleCanvas, width, height, trimTransparent)
      inner.phase('encode')
      return encodeSurfaceImage(
        ck,
        renderer,
        downsampleSurface,
        downsampleCanvas,
        width,
        height,
        format,
        quality,
        alphaBounds
      )
    } finally {
      // The un-supersampled path shares the outer surface, which the outer `finally` owns.
      if (downsamplePixels) {
        downsampleSurface.delete()
        ck.Free(downsamplePixels)
      }
    }
  } finally {
    inner.end({ width, height, renderScale })
    surface.delete()
    ck.Free(pixels)
  }
}

function prepareSelectionRenderGraph(
  source: SceneGraph,
  renderGraph: SceneGraph,
  pageId: string,
  nodeIds: string[]
): void {
  const page = renderGraph.getNode(pageId)
  if (!page) return

  page.childIds = nodeIds.filter((nodeId) => renderGraph.getNode(nodeId) !== undefined)
  for (const nodeId of page.childIds) {
    const node = renderGraph.getNode(nodeId)
    if (!node) continue
    const position = source.getAbsolutePosition(nodeId)
    node.parentId = pageId
    node.x = position.x
    node.y = position.y
  }
  renderGraph.clearAbsPosCache()
}

interface PreparedNodeRender {
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  pixelW: number
  pixelH: number
  renderGraph: SceneGraph
  renderPageId: string
}

/**
 * Shared prologue for rasterising a node selection: bounds, pixel size, and the graph to
 * draw from.
 *
 * The subset graph is built only when it will actually be used. `extractExportGraph` walks
 * the component-dependency closure, iterates every node in the document to pull in
 * referenced styles, sorts by depth with an ancestor walk inside the comparator, and
 * `structuredClone`s each node it keeps. It used to run unconditionally and then be thrown
 * away whenever a node needed the scene backdrop — common, since any non-normal blend mode
 * or background blur triggers it.
 */
function prepareNodeRender(
  graph: SceneGraph,
  pageId: string,
  nodeIds: string[],
  scale: number
): PreparedNodeRender | null {
  if (!ensureSinglePageSelection(graph, pageId, nodeIds)) {
    throw new Error('Raster export selection must stay on a single page')
  }

  const bounds = computeContentBounds(graph, nodeIds)
  if (!bounds) return null

  const contentW = bounds.maxX - bounds.minX
  const contentH = bounds.maxY - bounds.minY
  if (contentW <= 0 || contentH <= 0) return null

  const pixelW = Math.ceil(contentW * scale)
  const pixelH = Math.ceil(contentH * scale)
  if (pixelW <= 0 || pixelH <= 0) return null

  const needsSceneBackdrop = nodeIds.some((nodeId) => nodeNeedsSceneBackdrop(graph, nodeId))
  const extracted = needsSceneBackdrop
    ? null
    : extractExportGraph(graph, { scope: 'selection', nodeIds })
  if (extracted && !extracted.pageId) return null

  const renderGraph = extracted?.graph ?? graph
  const renderPageId = extracted?.pageId ?? pageId
  if (renderGraph !== graph) {
    prepareSelectionRenderGraph(graph, renderGraph, renderPageId, nodeIds)
  }

  return { bounds, pixelW, pixelH, renderGraph, renderPageId }
}

export interface RenderedPixels {
  /** Unpremultiplied RGBA, ready for `ImageData`. */
  pixels: Uint8Array
  width: number
  height: number
}

/** Copy CanvasKit's direct premultiplied buffer into `ImageData`-ready RGBA bytes. */
export function copyAndUnpremultiplyPixels(pixels: Uint8Array): Uint8Array {
  const copied = new Uint8Array(pixels)
  for (let index = 3; index < pixels.length; index += 4) {
    const alpha = pixels[index]
    if (alpha === 255) continue
    if (alpha === 0) {
      copied[index - 3] = 0
      copied[index - 2] = 0
      copied[index - 1] = 0
      continue
    }
    copied[index - 3] = Math.min(255, Math.round((pixels[index - 3] * 255) / alpha))
    copied[index - 2] = Math.min(255, Math.round((pixels[index - 2] * 255) / alpha))
    copied[index - 1] = Math.min(255, Math.round((pixels[index - 1] * 255) / alpha))
  }
  return copied
}

/**
 * Draw nodes and hand back raw pixels, skipping the encoder entirely.
 *
 * For a raster that is displayed immediately rather than written to a file, PNG is pure
 * overhead: encoding measured 476-1258ms for a full-screen slide, and whatever receives it
 * then has to decode it again. Callers that can take pixels — a canvas blit — should.
 */
export function renderNodesToPixels(
  ck: CanvasKit,
  renderer: SkiaRenderer,
  graph: SceneGraph,
  pageId: string,
  nodeIds: string[],
  scale: number
): RenderedPixels | null {
  const prepared = prepareNodeRender(graph, pageId, nodeIds, scale)
  if (!prepared) return null
  const { bounds, pixelW, pixelH, renderGraph, renderPageId } = prepared

  const profile = startRasterProfile('renderNodesToPixels')
  profile.phase('surface')
  const imageInfo = {
    alphaType: ck.AlphaType.Premul,
    colorType: ck.ColorType.RGBA_8888,
    colorSpace: ck.ColorSpace.SRGB,
    width: pixelW,
    height: pixelH
  }
  let buffer: MallocObj | null = null
  // A compatible surface shares the primary renderer's WebGL context, so its cached Skia
  // images remain valid and the slide is drawn by the GPU. Software/headless renderers keep
  // the direct raster path below.
  let surface: Surface | null = renderer.surface.reportBackendTypeIsGPU()
    ? renderer.surface.makeSurface(imageInfo)
    : null
  if (!surface) {
    buffer = ck.Malloc(Uint8Array, pixelW * pixelH * 4)
    surface = ck.MakeRasterDirectSurface(imageInfo, buffer, pixelW * 4)
  }
  if (!surface) {
    if (buffer) ck.Free(buffer)
    profile.end()
    return null
  }

  try {
    profile.phase('draw')
    const canvas = surface.getCanvas()
    canvas.clear(ck.TRANSPARENT)
    canvas.scale(scale, scale)
    canvas.translate(-bounds.minX, -bounds.minY)
    renderer.renderSceneToCanvas(canvas, renderGraph, renderPageId)
    surface.flush()

    if (buffer) {
      profile.phase('unpremultiplyPixels')
      const directPixels = buffer.toTypedArray()
      if (directPixels instanceof Uint8Array) {
        return {
          pixels: copyAndUnpremultiplyPixels(directPixels),
          width: pixelW,
          height: pixelH
        }
      }
    }

    profile.phase('readPixels')
    // Unpremultiplied because that is what `ImageData` expects; premultiplied bytes would
    // darken anything partially transparent.
    const read = canvas.readPixels(0, 0, {
      alphaType: ck.AlphaType.Unpremul,
      colorType: ck.ColorType.RGBA_8888,
      colorSpace: ck.ColorSpace.SRGB,
      width: pixelW,
      height: pixelH
    })
    if (!(read instanceof Uint8Array)) return null
    // Copy before the `finally` frees the surface: `readPixels` can hand back a view onto
    // the WASM heap, and returning that leaves the caller holding freed memory — which
    // paints as garbage or black once the allocator reuses it.
    return { pixels: new Uint8Array(read), width: pixelW, height: pixelH }
  } finally {
    profile.end({ width: pixelW, height: pixelH })
    surface.delete()
    if (buffer) ck.Free(buffer)
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
  const profile = startRasterProfile('renderNodesToImage')
  profile.phase('prepare')
  const prepared = prepareNodeRender(graph, pageId, nodeIds, options.scale)
  if (!prepared) {
    profile.end()
    return null
  }
  const { bounds, pixelW, pixelH, renderGraph, renderPageId } = prepared

  const quality = options.quality ?? (options.format === 'PNG' ? 100 : 90)
  profile.phase('renderToSurface')
  const bytes = renderToSurface(
    ck,
    renderer,
    renderGraph,
    renderPageId,
    pixelW,
    pixelH,
    options.format,
    quality,
    options.supersample ?? true,
    (canvas) => {
      canvas.clear(ck.TRANSPARENT)
      canvas.scale(options.scale, options.scale)
      canvas.translate(-bounds.minX, -bounds.minY)
    },
    options.trimTransparent
  )
  profile.end({ pixels: pixelW * pixelH, nodes: nodeIds.length })
  return bytes
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

  /**
   * Breathing room around the composition.
   *
   * Fitting content edge-to-edge is technically correct and looks wrong: the
   * editor shows a composition with margin around it, and a preview with none
   * reads as a crop rather than a view of the document. It also absorbs the
   * gap between a text node's measured box and the pixels its glyphs actually
   * cover, which was clipping wide headlines at the frame edge.
   */
  const PADDING = 0.92
  const scale = Math.min((width * PADDING) / contentW, (height * PADDING) / contentH, 2)

  // Read the stage colour from the DOCUMENT, not from the renderer.
  // `renderer.pageColor` is live editor state, synced only as a side effect of
  // the canvas render loop, so an export can legitimately run against a
  // renderer that never received it — and headless export has no loop at all.
  // The stored value is the one the file will be restored with, which is
  // exactly what a preview of that file should show.
  const stage = readStoredPageColor(graph, pageId) ?? renderer.pageColor
  return renderToSurface(ck, renderer, graph, pageId, width, height, 'PNG', 100, true, (canvas) => {
    canvas.clear(ck.Color4f(stage.r, stage.g, stage.b, 1))
    const offsetX = (width - contentW * scale) / 2 - bounds.minX * scale
    const offsetY = (height - contentH * scale) / 2 - bounds.minY * scale
    canvas.translate(offsetX, offsetY)
    canvas.scale(scale, scale)
  })
}
