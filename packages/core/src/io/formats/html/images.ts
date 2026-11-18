import { limitAsync } from 'es-toolkit'

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
  /** The most the page's pictures may hold together; past it, the rest keep their addresses. */
  maxBytes?: number
}

/** The most pictures read at once, so a page of many large ones is not all in flight together. */
const CONCURRENT_IMAGE_READS = 6

/** The most a page's pictures may hold together by default, as the HTML engine caps a page. */
export const MAX_PAGE_IMAGE_BYTES = 256 * 1024 * 1024

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
 * is. Each address is fetched once however many elements show it, a few at a time, and the
 * pictures together stay within `maxBytes`. One that fails, does not hold a PNG, JPEG, GIF, WebP,
 * or AVIF, or would pass the budget stays its address, as the import keeps it.
 */
export async function embedPageImages(
  styled: DesignDocument,
  { baseURL, fetch, signal, maxBytes = MAX_PAGE_IMAGE_BYTES }: EmbedPageImagesOptions
): Promise<void> {
  const images = designElements(styled.children).filter(
    (element) => element.tagName.toLowerCase() === 'img' && element.attrs.src
  )
  let total = 0
  const read = limitAsync(async (url: string): Promise<string | null> => {
    if (signal?.aborted || total >= maxBytes) return null
    const bytes = await fetch(url, signal).catch(() => null)
    if (!bytes || !imageHeader(bytes) || total + bytes.byteLength > maxBytes) return null
    total += bytes.byteLength
    return imageDataURL(bytes)
  }, CONCURRENT_IMAGE_READS)
  const urls = new Map<string, Promise<string | null>>()
  const embedded = (url: string) => {
    let pending = urls.get(url)
    if (!pending) {
      pending = read(url)
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
