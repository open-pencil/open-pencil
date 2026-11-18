import type { DesignDocument } from '@open-pencil/dom-css'
import { imageDataURL, imageHeader } from '@open-pencil/scene-graph/images'

import { designElements } from './elements'

/** Reads the bytes at a URL, or null when it cannot. */
export type PageImageFetch = (url: string, signal?: AbortSignal) => Promise<Uint8Array | null>

export interface EmbedPageImagesOptions {
  /** Where the page came from, which the sources of its images resolve against. */
  baseURL?: string
  fetch: PageImageFetch
  signal?: AbortSignal
}

/** An image source resolved against the page's address, or null for one with no address. */
function imageURL(source: string, baseURL: string | undefined): string | null {
  try {
    const url = new URL(source, baseURL)
    return url.protocol === 'data:' ? null : url.href
  } catch {
    return null
  }
}

/**
 * Fetches the pictures a page's `<img>` elements show and writes each into its element as a data
 * URL, so the layers it becomes are filled with the picture, as an image the page carried inline
 * is. Each address is fetched once however many elements show it; one that fails, or does not
 * hold a PNG, JPEG, GIF, WebP, or AVIF, stays its address, as the import keeps it.
 */
export async function embedPageImages(
  styled: DesignDocument,
  { baseURL, fetch, signal }: EmbedPageImagesOptions
): Promise<void> {
  const images = designElements(styled.children).filter(
    (element) => element.tagName.toLowerCase() === 'img' && element.attrs.src
  )
  const urls = new Map<string, Promise<string | null>>()
  const embedded = (url: string) => {
    let pending = urls.get(url)
    if (!pending) {
      pending = fetch(url, signal)
        .catch(() => null)
        .then((bytes) => (bytes && imageHeader(bytes) ? imageDataURL(bytes) : null))
      urls.set(url, pending)
    }
    return pending
  }
  await Promise.all(
    images.map(async (image) => {
      const url = imageURL(image.attrs.src, baseURL)
      const data = url ? await embedded(url) : null
      if (data) image.attrs.src = data
    })
  )
  signal?.throwIfAborted()
}
