import { computeContentBounds } from '@open-pencil/core/io/formats/raster'

import type { EditorStore } from '@/app/editor/active-store'

export const DEFAULT_VISION_MAX_EDGE = 1280

/** A render of layers for a model to look at: the encoded PNG, and the size it was drawn at. */
export interface ModelRender {
  png: Uint8Array
  width: number
  height: number
}

export function boundedImageScale(
  width: number,
  height: number,
  maxEdge = DEFAULT_VISION_MAX_EDGE
): number {
  const longestEdge = Math.max(width, height)
  if (longestEdge <= 0) return 0
  return Math.min(1, maxEdge / longestEdge)
}

/**
 * The layers on `pageId` drawn together as a PNG whose longer edge is at most `maxEdge`. Null
 * when they show nothing or cannot be drawn.
 */
export async function renderForModel(
  store: EditorStore,
  nodeIds: readonly string[],
  pageId: string,
  maxEdge = DEFAULT_VISION_MAX_EDGE
): Promise<ModelRender | null> {
  const bounds = computeContentBounds(store.graph, [...nodeIds])
  if (!bounds) return null
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  const scale = boundedImageScale(width, height, maxEdge)
  if (scale <= 0) return null
  const png = await store.renderExportImage([...nodeIds], scale, 'PNG', pageId)
  if (!png) return null
  return { png, width: Math.ceil(width * scale), height: Math.ceil(height * scale) }
}
