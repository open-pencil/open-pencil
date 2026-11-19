import type { SceneGraph } from '@open-pencil/scene-graph'

import { isLibraryComponentAsset } from './asset-keys'
import type { ComponentLibraryRevision } from './types'

/** The longest side of a library asset's thumbnail, in pixels. */
export const LIBRARY_THUMBNAIL_SIZE = 256

/**
 * Draws a layer of a revision as a PNG whose longest side is `LIBRARY_THUMBNAIL_SIZE`: the app
 * with its canvas renderer, the CLI headless.
 */
export type LibraryThumbnailRenderer = (
  graph: SceneGraph,
  pageId: string,
  nodeId: string
) => Promise<Uint8Array | null>

/** Gives each published component and set a thumbnail, for catalogs that cannot draw it. */
export async function renderLibraryThumbnails(
  revision: ComponentLibraryRevision,
  render: LibraryThumbnailRenderer
): Promise<void> {
  for (const asset of revision.manifest.assets) {
    if (!isLibraryComponentAsset(asset)) continue
    const pageId = revision.graph.pageOf(asset.sourceId)
    if (!pageId) continue
    const png = await render(revision.graph, pageId, asset.sourceId)
    if (png) asset.thumbnail = png
  }
}
