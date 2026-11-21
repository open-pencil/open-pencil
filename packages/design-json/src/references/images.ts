import type { ResolvedOptions } from '#design-json/options'
import { writtenLayers, type References } from '#design-json/references/context'
import type { DesignJSONImage } from '#design-json/types'
import { stringsIn } from '#design-json/values'

import { imageDataURL, imageMimeType } from '@open-pencil/scene-graph/images'

/** The images the written layers' paints draw, by hash. */
export function addImages(references: References) {
  if (references.writer.options.images === 'omit') return
  for (const hash of stringsIn(writtenLayers(references))) addImage(references, hash)
}

function addImage(references: References, hash: string) {
  const { document, writer } = references
  if (hash in document.images) return
  const data = writer.graph.images.get(hash)
  if (!data) return
  document.images[hash] = describeImage(data, writer.options)
}

function describeImage(data: Uint8Array, options: ResolvedOptions): DesignJSONImage {
  const image = { mimeType: imageMimeType(data), byteLength: data.byteLength }
  if (options.images !== 'data-url') return image
  return { ...image, dataURL: imageDataURL(data) }
}
