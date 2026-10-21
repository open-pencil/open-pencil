import type { CanvasKit } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { SkiaRenderer } from '#core/canvas'
import { documentThumbnailPageId } from '#core/io/formats/fig/thumbnail-page'

import { renderThumbnail } from './render'

/**
 * A renderer that is never shown, on a 1×1 surface: renders draw to surfaces of their own. Its
 * fonts are not loaded yet. The caller destroys it.
 */
export function offscreenRenderer(ck: CanvasKit): SkiaRenderer {
  const surface = ck.MakeSurface(1, 1)
  if (!surface) throw new Error('Failed to create CanvasKit surface')
  const renderer = new SkiaRenderer(ck, surface)
  renderer.viewportWidth = 1
  renderer.viewportHeight = 1
  renderer.dpr = 1
  return renderer
}

/** An offscreen renderer with its fonts loaded. The caller destroys it. */
export async function createOffscreenRenderer(ck: CanvasKit): Promise<SkiaRenderer> {
  const renderer = offscreenRenderer(ck)
  try {
    await renderer.loadFonts()
  } catch (error) {
    renderer.destroy()
    throw error
  }
  return renderer
}

/**
 * A PNG preview, at most `size` px on its longest side, of a design that is not open: its cover
 * page, or its first page when it has none. Null when that page is empty.
 */
export async function renderOffscreenThumbnail(
  ck: CanvasKit,
  graph: SceneGraph,
  size: number
): Promise<Uint8Array | null> {
  const pageId = documentThumbnailPageId(graph.getPages())
  const page = pageId ? graph.getNode(pageId) : undefined
  if (!pageId || !page) return null
  const renderer = await createOffscreenRenderer(ck)
  try {
    await renderer.prepareForExport(graph, pageId, [...page.childIds])
    return renderThumbnail(ck, renderer, graph, pageId, size, size)
  } finally {
    renderer.destroy()
  }
}
