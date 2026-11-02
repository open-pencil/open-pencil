import { parseFigBuffer } from '@open-pencil/fig'
import { imageSize } from '@open-pencil/scene-graph/images'
import type { Size } from '@open-pencil/scene-graph/primitives'

/** The size of the `thumbnail.png` a `.fig` carries. */
export function figThumbnailSize(fig: Uint8Array): Size {
  const png = parseFigBuffer(fig.slice().buffer).thumbnailPNG
  const size = png && imageSize(png)
  if (!size) throw new Error('The archive has no thumbnail.png')
  return size
}
