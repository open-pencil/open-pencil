import type { NodeChange } from '@lawha/kiwi/fig/codec'

import { bytesToHex } from '../node-change/bytes'
import { forEachImageReference, nameImagesForFigma } from '../node-change/images'

/**
 * Clipboard recipients cannot fetch images from an Lawha source file, so the images the
 * pasted records use travel with them as blobs, each once, under the name Figma reads them by.
 */
export function embedClipboardImages(
  changes: NodeChange[],
  blobs: Uint8Array[],
  images: ReadonlyMap<string, Uint8Array>
): void {
  const names = nameImagesForFigma(changes, images)
  const bytesByName = new Map<string, Uint8Array>()
  for (const [name, bytes] of images) bytesByName.set(names.get(name) ?? name, bytes)
  const indexes = new Map<string, number>()
  forEachImageReference(changes, (image) => {
    if (image.hash === undefined) return
    const name = typeof image.hash === 'string' ? image.hash : bytesToHex(image.hash)
    const bytes = bytesByName.get(name)
    if (!bytes) return
    let index = indexes.get(name)
    if (index === undefined) {
      index = blobs.length
      blobs.push(bytes)
      indexes.set(name, index)
    }
    image.dataBlob = index
  })
}
