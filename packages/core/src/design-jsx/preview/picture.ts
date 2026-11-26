import type { CanvasKit, SkPicture } from '@open-pencil/canvaskit'
import type { VisualBounds } from '@open-pencil/scene-graph/geometry'

import { withOffscreenRenderer } from '#core/canvas/renderer/offscreen'
import { recordWorldPicture } from '#core/canvas/renderer/picture'
import type { SkiaRenderer } from '#core/canvas/renderer/skia'
import { computeContentBounds } from '#core/canvas/renderer/visual-bounds'

import type { StagedJSXPreview } from './stage'

const MAX_PREVIEW_DIMENSION = 8192

function fitsPreview({ minX, minY, maxX, maxY }: VisualBounds): boolean {
  const width = maxX - minX
  const height = maxY - minY
  return (
    Number.isFinite(width + height) &&
    width > 0 &&
    height > 0 &&
    width <= MAX_PREVIEW_DIMENSION &&
    height <= MAX_PREVIEW_DIMENSION
  )
}

async function recordStaged(
  renderer: SkiaRenderer,
  { graph, pageId, nodeIds }: StagedJSXPreview,
  signal: AbortSignal
): Promise<SkPicture | null> {
  renderer.pageId = pageId
  await renderer.prepareForExport(graph, pageId, nodeIds)
  signal.throwIfAborted()
  const bounds = computeContentBounds(graph, nodeIds)
  if (!bounds || !fitsPreview(bounds)) return null
  return recordWorldPicture(renderer, bounds, (canvas) => {
    for (const id of nodeIds) renderer.renderNode(canvas, graph, id, {})
  })
}

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
  return withOffscreenRenderer(ck, async (renderer) => {
    signal.throwIfAborted()
    return recordStaged(renderer, staged, signal)
  })
}
