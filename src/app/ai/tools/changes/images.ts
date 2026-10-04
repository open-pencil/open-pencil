import { promiseTimeout } from '@vueuse/core'

import {
  comparePNGs,
  computeContentBounds,
  createCanvasKitRasterCodec,
  renderRegionToImage
} from '@open-pencil/core/io/formats/raster'
import type { SceneGraph } from '@open-pencil/scene-graph'
import type { VisualBounds } from '@open-pencil/scene-graph/geometry'

import { boundedImageScale } from '@/app/ai/tools/vision'
import type { EditorStore } from '@/app/editor/active-store'
import type { ChangePreviewSize } from '@/app/settings/preferences/store'

import type { ToolChangeImages } from './types'

/** Longest stored image edge, in pixels, for each preview size. */
export const CHANGE_PREVIEW_MAX_EDGE: Record<Exclude<ChangePreviewSize, 'off'>, number> = {
  small: 240,
  medium: 480,
  large: 960
}

/** Context kept around the changed layers, in document units. */
const REGION_MARGIN = 16

interface ChangeRegion {
  beforeGraph: SceneGraph
  afterGraph: SceneGraph
  pageId: string
  nodeIds: string[]
  size: Exclude<ChangePreviewSize, 'off'>
}

function regionOf(graph: SceneGraph, nodeIds: string[]): VisualBounds | null {
  const present = nodeIds.filter((id) => graph.getNode(id) !== undefined)
  return present.length > 0 ? computeContentBounds(graph, present) : null
}

function unionRegion(regions: (VisualBounds | null)[]): VisualBounds | null {
  const known = regions.filter((region) => region !== null)
  if (known.length === 0) return null
  return {
    minX: Math.min(...known.map((region) => region.minX)) - REGION_MARGIN,
    minY: Math.min(...known.map((region) => region.minY)) - REGION_MARGIN,
    maxX: Math.max(...known.map((region) => region.maxX)) + REGION_MARGIN,
    maxY: Math.max(...known.map((region) => region.maxY)) + REGION_MARGIN
  }
}

function pngBlob(bytes: Uint8Array | null): Blob | null {
  return bytes ? new Blob([new Uint8Array(bytes)], { type: 'image/png' }) : null
}

/**
 * Renders the changed region in both states at the same bounds and scale, and highlights the
 * pixels that differ. Runs after the tool returns so the model never waits for it.
 */
export async function renderToolChangeImages(
  store: EditorStore,
  { beforeGraph, afterGraph, pageId, nodeIds, size }: ChangeRegion
): Promise<ToolChangeImages | null> {
  // Let the tool result reach the model before rendering.
  await promiseTimeout(0)
  const renderer = store.renderer
  if (!renderer) return null
  const bounds = unionRegion([regionOf(beforeGraph, nodeIds), regionOf(afterGraph, nodeIds)])
  if (!bounds) return null
  const scale = boundedImageScale(
    bounds.maxX - bounds.minX,
    bounds.maxY - bounds.minY,
    CHANGE_PREVIEW_MAX_EDGE[size]
  )
  if (scale <= 0) return null
  const { ck, pageColor } = renderer
  const [before, after] = await Promise.all([
    renderRegionToImage(ck, beforeGraph, pageId, bounds, scale, { pageColor }),
    renderRegionToImage(ck, afterGraph, pageId, bounds, scale, { pageColor })
  ])
  const comparison =
    before && after ? comparePNGs(createCanvasKitRasterCodec(ck), before, after) : null
  return {
    before: pngBlob(before),
    after: pngBlob(after),
    highlight: pngBlob(comparison?.mask ?? null),
    width: comparison?.width ?? 0,
    height: comparison?.height ?? 0,
    changedRatio: comparison ? comparison.changedPixels / comparison.totalPixels : 0
  }
}
