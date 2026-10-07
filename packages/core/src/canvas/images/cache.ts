import type { Image } from 'canvaskit-wasm'

import { ResourceCache } from '#core/cache/resource'

export const IMAGE_CACHE_BYTES = 128 * 1024 * 1024

/** Own decoded images, including an estimate for their mipmaps. Pictures may retain references. */
export function createImageCache<T extends Pick<Image, 'width' | 'height' | 'delete'> = Image>(
  maxBytes = IMAGE_CACHE_BYTES
) {
  return new ResourceCache<string, T>({
    maxEntries: 256,
    maxWeight: maxBytes,
    weight: (image) => Math.ceil(image.width() * image.height() * 4 * (4 / 3)),
    dispose: (image) => image.delete()
  })
}
