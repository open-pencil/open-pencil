import type { CanvasKit, SkPicture } from 'canvaskit-wasm'

import { computeDescendantVisualBounds } from '@open-pencil/scene-graph/geometry'

import { SkiaRenderer } from '#core/canvas/renderer'
import { computeAllLayouts, getTextMeasurer, setTextMeasurer } from '#core/layout'
import { prepareGraphFonts } from '#core/text/prepare'

import type { StagedJSXPreview } from './stage'

const MAX_PREVIEW_DIMENSION = 8192

/**
 * Record a disposable vector picture using a private graph and renderer.
 * Neither speculative nodes nor renderer caches enter the live document.
 * The caller owns the returned picture, even when its request becomes stale.
 */
export async function recordJSXPreview(
  ck: CanvasKit,
  staged: StagedJSXPreview,
  signal: AbortSignal
): Promise<SkPicture | null> {
  signal.throwIfAborted()
  const surface = ck.MakeSurface(1, 1)
  if (!surface) return null
  const renderer = new SkiaRenderer(ck, surface)
  try {
    const { graph, pageId, nodeIds } = staged
    renderer.pageId = pageId
    await renderer.loadFonts()
    signal.throwIfAborted()
    await prepareGraphFonts(graph, nodeIds)
    signal.throwIfAborted()
    // Layout's measurer is shared. Override only synchronously, never across an await.
    const previous = getTextMeasurer()
    setTextMeasurer((node, width) => renderer.measureTextNode(node, width))
    try {
      computeAllLayouts(graph, pageId)
    } finally {
      setTextMeasurer(previous)
    }
    const bounds = computeDescendantVisualBounds(
      nodeIds,
      (id) => graph.getNode(id),
      (id) => graph.getAbsolutePosition(id)
    )
    if (!bounds) return null
    const width = bounds.maxX - bounds.minX
    const height = bounds.maxY - bounds.minY
    if (
      !Number.isFinite(width + height) ||
      width <= 0 ||
      height <= 0 ||
      width > MAX_PREVIEW_DIMENSION ||
      height > MAX_PREVIEW_DIMENSION
    )
      return null
    const recorder = new ck.PictureRecorder()
    try {
      const canvas = recorder.beginRecording(
        ck.LTRBRect(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY)
      )
      renderer.worldViewport = { x: bounds.minX, y: bounds.minY, w: width, h: height }
      renderer.syncFontGeneration()
      for (const id of nodeIds) renderer.renderNode(canvas, graph, id, {})
      return recorder.finishRecordingAsPicture()
    } finally {
      recorder.delete()
    }
  } finally {
    renderer.destroy()
  }
}
