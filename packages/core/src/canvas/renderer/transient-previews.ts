import type { Canvas, SkPicture } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'

import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer'

/** Borrowed picture. The publisher owns disposal, including removal from every renderer. */
export interface TransientCanvasPreview {
  graph: SceneGraph
  pageId: string
  picture: SkPicture
  /** Substitute a whole page child, including its proposed descendant layout. */
  replaceId?: string
  /** Insert before this page-child index, or append when omitted. */
  insertIndex?: number
}

function activePreviews(r: SkiaRenderer, graph: SceneGraph): TransientCanvasPreview[] {
  return [...r.transientPreviews.values()].filter(
    (preview) => preview.graph === graph && preview.pageId === r.pageId
  )
}

export function hasTransientPreviews(r: SkiaRenderer, graph: SceneGraph): boolean {
  return activePreviews(r, graph).length > 0
}

/** Draw at the normal scene z-order, not over the top of unchanged originals. Never used for export. */
export function renderPageWithPreviews(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  overlays: RenderOverlays
): boolean {
  const previews = activePreviews(r, graph)
  if (previews.length === 0) return false
  const children = graph.getNode(r.pageId ?? graph.rootId)?.childIds ?? []
  const replacements = new Map<string, TransientCanvasPreview>()
  const insertions = new Map<number, TransientCanvasPreview[]>()
  for (const preview of previews) {
    if (preview.replaceId) {
      replacements.set(preview.replaceId, preview)
    } else {
      const index = Math.min(preview.insertIndex ?? children.length, children.length)
      const atIndex = insertions.get(index) ?? []
      atIndex.push(preview)
      insertions.set(index, atIndex)
    }
  }
  for (let index = 0; index <= children.length; index++) {
    for (const preview of insertions.get(index) ?? []) canvas.drawPicture(preview.picture)
    const id = children[index]
    if (!id) continue
    const replacement = replacements.get(id)
    if (replacement) canvas.drawPicture(replacement.picture)
    else r.renderNode(canvas, graph, id, overlays)
  }
  return true
}
