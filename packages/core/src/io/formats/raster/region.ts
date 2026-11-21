import type { CanvasKit } from '@open-pencil/canvaskit'
import type { SceneGraph } from '@open-pencil/scene-graph'
import type { VisualBounds } from '@open-pencil/scene-graph/geometry'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { withOffscreenRenderer } from '#core/canvas/renderer/offscreen'

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
  return withOffscreenRenderer(ck, async (renderer) => {
    if (options.pageColor) renderer.pageColor = options.pageColor
    await renderer.prepareForExport(graph, pageId, graph.getNode(pageId)?.childIds ?? [])
    return drawRegionToImage(ck, renderer, graph, pageId, bounds, scale)
  })
}
