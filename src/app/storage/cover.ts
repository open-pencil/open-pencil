import { CLOUD_COVER_SIZE } from '@open-pencil/cloud/contract'
import type { Editor } from '@open-pencil/core'
import { documentThumbnailSubject } from '@open-pencil/core/io/formats/fig'
import { renderCover } from '@open-pencil/core/io/formats/raster'
import type { SceneGraph } from '@open-pencil/scene-graph'

/**
 * The cover a save draws for storage that shows covers: the layer set as the document's thumbnail,
 * or else the top of `pageId`, the page in view, which is loaded, unlike pages not opened yet.
 * Null when there is nothing to draw.
 */
export function drawStorageCover(
  graph: SceneGraph,
  renderer: NonNullable<Editor['renderer']>,
  pageId: string
): Uint8Array | null {
  const subject = documentThumbnailSubject(graph, pageId)
  if (!subject) return null
  const { width, height } = CLOUD_COVER_SIZE
  return renderCover(renderer.ck, renderer, graph, subject.pageId, width, height, subject.nodeIds)
}
