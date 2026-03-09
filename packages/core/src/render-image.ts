import type { SkiaRenderer } from './renderer'
import type { SceneGraph } from './scene-graph'
import type { CanvasKit, Canvas } from 'canvaskit-wasm'

export type ExportFormat = 'PNG' | 'JPG' | 'WEBP' | 'SVG'

interface RenderOptions {
  scale: number
  format: ExportFormat
  quality?: number
}

export function computeContentBounds(
  graph: SceneGraph,
  nodeIds: string[]
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity

  for (const id of nodeIds) {
    const node = graph.getNode(id)
    if (!node || !node.visible) continue
    const abs = graph.getAbsolutePosition(id)
    minX = Math.min(minX, abs.x)
    minY = Math.min(minY, abs.y)
    maxX = Math.max(maxX, abs.x + node.width)
    maxY = Math.max(maxY, abs.y + node.height)
  }

  if (!isFinite(minX)) return null
  return { minX, minY, maxX, maxY }
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

function renderToSurface(
  ck: CanvasKit,
  renderer: SkiaRenderer,
  graph: SceneGraph,
  pageId: string,
  width: number,
  height: number,
  format: ExportFormat,
  quality: number,
  setup: (canvas: Canvas) => void
): Uint8Array | null {
  const surface = ck.MakeSurface(width, height)
  if (!surface) return null

  try {
    const canvas = surface.getCanvas()
    setup(canvas)
    renderer.renderSceneToCanvas(canvas, graph, pageId)
    surface.flush()
    const image = surface.makeImageSnapshot()
    const encoded = image.encodeToBytes(ckImageFormat(ck, format), quality)
    image.delete()
    return encoded ? new Uint8Array(encoded) : null
  } finally {
    surface.delete()
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
  const bounds = computeContentBounds(graph, nodeIds)
  if (!bounds) return null

  const contentW = bounds.maxX - bounds.minX
  const contentH = bounds.maxY - bounds.minY
  if (contentW <= 0 || contentH <= 0) return null

  const pixelW = Math.ceil(contentW * options.scale)
  const pixelH = Math.ceil(contentH * options.scale)
  if (pixelW <= 0 || pixelH <= 0) return null

  const quality = options.quality ?? (options.format === 'PNG' ? 100 : 90)
  return renderToSurface(
    ck,
    renderer,
    graph,
    pageId,
    pixelW,
    pixelH,
    options.format,
    quality,
    (canvas) => {
      canvas.clear(ck.TRANSPARENT)
      canvas.scale(options.scale, options.scale)
      canvas.translate(-bounds.minX, -bounds.minY)
    }
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
