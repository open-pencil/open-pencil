import type { CanvasKit } from 'canvaskit-wasm'

import type { Color, SceneGraph } from '@open-pencil/scene-graph'
import type { VisualBounds } from '@open-pencil/scene-graph/geometry'

import { SkiaRenderer } from '#core/canvas'

import { drawRegionToImage } from './render'

export interface RegionRenderOptions {
  /** Background behind the page content; the live canvas's page colour by default. */
  pageColor?: Color
}

/**
 * Renders everything on a page inside `bounds`, over the page colour, as a PNG. Two states of
 * one region rendered with the same bounds and scale align pixel for pixel.
 *
 * Each call uses a renderer of its own. Renderer caches are keyed by node ID, so drawing a past
 * state of live nodes with the editor's renderer would leave that geometry on the live canvas.
 */
export async function renderRegionToImage(
  ck: CanvasKit,
  graph: SceneGraph,
  pageId: string,
  bounds: VisualBounds,
  scale: number,
  options: RegionRenderOptions = {}
): Promise<Uint8Array | null> {
  const surface = ck.MakeSurface(1, 1)
  if (!surface) return null
  const renderer = new SkiaRenderer(ck, surface)
  try {
    if (options.pageColor) renderer.pageColor = options.pageColor
    await renderer.loadFonts()
    await renderer.prepareForExport(graph, pageId, graph.getNode(pageId)?.childIds ?? [])
    return drawRegionToImage(ck, renderer, graph, pageId, bounds, scale)
  } finally {
    renderer.destroy()
  }
}
