import { CLOUD_COVER_SIZE } from '@open-pencil/cloud/contract'
import { documentThumbnailSubject, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { headlessRenderCover } from '@open-pencil/core/io/formats/raster'

/**
 * The cover the editor draws when it saves `bytes` to Cloud: the layer set as the file's thumbnail,
 * or else the top of its cover page, at `CLOUD_COVER_SIZE`. Null when there is nothing to draw.
 */
export async function exampleCover(bytes: Uint8Array): Promise<Uint8Array | null> {
  const graph = await parseFigFile(bytes.slice().buffer, { populate: 'all' })
  const subject = documentThumbnailSubject(graph)
  if (!subject) return null
  const { width, height } = CLOUD_COVER_SIZE
  return headlessRenderCover(graph, subject.pageId, width, height, subject.nodeIds)
}
