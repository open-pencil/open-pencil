import { computeVisualBounds } from '../../../geometry'
import { extractExportGraph } from '../../subgraph'

import type { RenderColorSpace } from '@open-pencil/core/color-management'
import type { SkiaRenderer } from '@open-pencil/core/renderer'
import type { SceneGraph } from '@open-pencil/core/scene-graph'
import type { CanvasKit, Canvas } from 'canvaskit-wasm'

export type RasterExportFormat = 'PNG' | 'JPG' | 'WEBP'
export type ExportFormat = RasterExportFormat | 'SVG'

interface RenderOptions {
  scale: number
  format: ExportFormat
  quality?: number
  colorSpace?: RenderColorSpace
}

function findPageId(graph: SceneGraph, nodeId: string): string | null {
  let current = graph.getNode(nodeId)
  while (current?.parentId) {
    const parent = graph.getNode(current.parentId)
    if (!parent) return null
    if (parent.type === 'CANVAS') return parent.id
    current = parent
  }
  return current?.type === 'CANVAS' ? current.id : null
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

export function computeContentBounds(
  graph: SceneGraph,
  nodeIds: string[]
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const nodes = nodeIds
    .map((id) => graph.getNode(id))
    .filter(
      (node): node is NonNullable<ReturnType<SceneGraph['getNode']>> => !!node && node.visible
    )

  if (nodes.length === 0) return null

  const bounds = computeVisualBounds(nodes, (id) => graph.getAbsolutePosition(id))
  return {
    minX: bounds.x,
    minY: bounds.y,
    maxX: bounds.x + bounds.width,
    maxY: bounds.y + bounds.height
  }
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
  renderGraph: SceneGraph,
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
    renderer.renderSceneToCanvas(canvas, renderGraph, pageId)
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
