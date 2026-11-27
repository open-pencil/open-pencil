import type { CanvasKit } from '@open-pencil/canvaskit'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { toExtendedSRGB } from '@open-pencil/scene-graph/color'
import type { VisualBounds } from '@open-pencil/scene-graph/geometry'

import type { SkiaRenderer } from '#core/canvas'
import { computeContentBounds } from '#core/canvas/renderer/visual-bounds'
import { getPageColor } from '#core/figma-api/page-backgrounds'
import { extractExportGraph } from '#core/io/subgraph'

import { prepareSelectionRenderGraph, renderToSurface } from './render'

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

/**
 * The page region a thumbnail of `width` by `height` pixels shows, and its size: `nodeIds` whole,
 * by default everything on the page. `renderThumbnail` then draws only those layers.
 */
export function thumbnailFrame(
  graph: SceneGraph,
  pageId: string,
  width: number,
  height: number,
  fit: ThumbnailFit = 'contain',
  nodeIds?: readonly string[]
): ThumbnailFrame | null {
  const page = graph.getNode(pageId)
  const content = nodeIds ?? page?.childIds ?? []
  if (!page || content.length === 0) return null

  const bounds = computeContentBounds(graph, content)
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

/**
 * The page region a cover of `width` by `height` pixels shows: `nodeIds` whole and centred, or
 * without them the top of the page, as wide as everything on it, so a tall page shows its first
 * screens at a size people can read rather than all of it as a strip.
 */
export function coverFrame(
  graph: SceneGraph,
  pageId: string,
  width: number,
  height: number,
  nodeIds?: readonly string[]
): ThumbnailFrame | null {
  if (nodeIds) return thumbnailFrame(graph, pageId, width, height, 'letterbox', nodeIds)
  const page = graph.getNode(pageId)
  const bounds = page ? computeContentBounds(graph, page.childIds) : null
  if (!bounds) return null
  const contentW = bounds.maxX - bounds.minX
  if (contentW <= 0) return null
  const sliceH = (contentW * height) / width
  // Content no taller than the cover's shape fits whole.
  if (bounds.maxY - bounds.minY <= sliceH) {
    return thumbnailFrame(graph, pageId, width, height, 'letterbox')
  }
  return {
    bounds: { ...bounds, maxY: bounds.minY + sliceH },
    scale: width / contentW,
    width,
    height
  }
}

/** Draws a cover of `graph`'s page `pageId`, framed as `coverFrame` frames it. */
export function renderCover(
  ck: CanvasKit,
  renderer: SkiaRenderer,
  graph: SceneGraph,
  pageId: string,
  width: number,
  height: number,
  nodeIds?: readonly string[]
): Uint8Array<ArrayBuffer> | null {
  return renderer.withoutTextEdit(() => {
    const frame = coverFrame(graph, pageId, width, height, nodeIds)
    return frame ? drawFrame(ck, renderer, graph, pageId, frame, nodeIds) : null
  })
}

export function renderThumbnail(
  ck: CanvasKit,
  renderer: SkiaRenderer,
  graph: SceneGraph,
  pageId: string,
  width: number,
  height: number,
  fit: ThumbnailFit = 'contain',
  nodeIds?: readonly string[]
): Uint8Array<ArrayBuffer> | null {
  return renderer.withoutTextEdit(() =>
    drawThumbnail(ck, renderer, graph, pageId, width, height, fit, nodeIds)
  )
}

function drawThumbnail(
  ck: CanvasKit,
  renderer: SkiaRenderer,
  graph: SceneGraph,
  pageId: string,
  width: number,
  height: number,
  fit: ThumbnailFit,
  nodeIds: readonly string[] | undefined
): Uint8Array<ArrayBuffer> | null {
  const frame = thumbnailFrame(graph, pageId, width, height, fit, nodeIds)
  return frame ? drawFrame(ck, renderer, graph, pageId, frame, nodeIds) : null
}

/** Draws `frame` of the page on its own background, only `nodeIds` when given. */
function drawFrame(
  ck: CanvasKit,
  renderer: SkiaRenderer,
  graph: SceneGraph,
  pageId: string,
  frame: ThumbnailFrame,
  nodeIds: readonly string[] | undefined
): Uint8Array<ArrayBuffer> | null {
  const { bounds, scale, width: pixelW, height: pixelH } = frame
  // The page's own background, which the editor's page colour matches only while it is open.
  const background = toExtendedSRGB(getPageColor(graph.getNode(pageId)), graph.documentColorSpace)
  // Given layers are drawn alone, as Figma draws a frame set as thumbnail, without the layers
  // around or over it that its bounds also cover.
  const drawn = nodeIds ? selectionRenderGraph(graph, nodeIds) : { graph, pageId }
  if (!drawn) return null

  return renderToSurface(ck, renderer, {
    graph: drawn.graph,
    pageId: drawn.pageId,
    width: pixelW,
    height: pixelH,
    format: 'PNG',
    quality: 100,
    setup: (canvas) => {
      canvas.clear(ck.Color4f(background.r, background.g, background.b, 1))
      canvas.translate(-bounds.minX * scale, -bounds.minY * scale)
      canvas.scale(scale, scale)
    }
  })
}

/** A copy of `graph` whose page holds only `nodeIds`, placed where they are, to draw them alone. */
function selectionRenderGraph(
  graph: SceneGraph,
  nodeIds: readonly string[]
): { graph: SceneGraph; pageId: string } | null {
  const extracted = extractExportGraph(graph, { scope: 'selection', nodeIds: [...nodeIds] })
  if (!extracted.pageId) return null
  prepareSelectionRenderGraph(graph, extracted.graph, extracted.pageId, [...nodeIds])
  return { graph: extracted.graph, pageId: extracted.pageId }
}
