import type { CanvasKit, SkPicture } from 'canvaskit-wasm'

import { computeDescendantVisualBounds, type VisualBounds } from '@open-pencil/scene-graph/geometry'

import { SkiaRenderer } from '#core/canvas/renderer'
import { recordWorldPicture } from '#core/canvas/renderer/picture'

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
  await renderer.loadFonts()
  signal.throwIfAborted()
  await renderer.prepareForExport(graph, pageId, nodeIds)
  signal.throwIfAborted()
  const bounds = computeDescendantVisualBounds(
    nodeIds,
    (id) => graph.getNode(id),
    (id) => graph.getAbsolutePosition(id)
  )
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
  const surface = ck.MakeSurface(1, 1)
  if (!surface) return null
  const renderer = new SkiaRenderer(ck, surface)
  try {
    return await recordStaged(renderer, staged, signal)
  } finally {
    renderer.destroy()
  }
}
