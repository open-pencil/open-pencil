import type { DesignResource, DesignResourceFetch } from '@open-pencil/dom-css'
import { parseDataURL } from '@open-pencil/scene-graph/images'

import { readBoundedBody } from './body'
import { mediaType } from './file'

/** The most one file a page loads, such as a stylesheet, font, or picture, may hold. */
export const MAX_PAGE_FILE_BYTES = 64 * 1024 * 1024

/** The most the files one page loads may hold together, so a page cannot exhaust memory. */
export const MAX_PAGE_RESOURCE_BYTES = 256 * 1024 * 1024

/**
 * Reads the files a page loads, such as stylesheets, fonts, and pictures, with `fetch`: each up
 * to `maxBytes`, from the address a redirect ends at, with the media type its server sent. A
 * `data:` URL carries its file in itself, so it is read from the URL, never sent anywhere.
 */
export function networkResourceFetch(
  fetch: typeof globalThis.fetch,
  maxBytes = MAX_PAGE_FILE_BYTES
): DesignResourceFetch {
  return async (url, signal) => {
    if (URL.canParse(url) && new URL(url).protocol === 'data:') {
      const data = parseDataURL(url)
      return data && data.bytes.byteLength <= maxBytes
        ? { url, bytes: data.bytes, contentType: data.mimeType }
        : null
    }
    const response = await fetch(url, { signal }).catch(() => null)
    if (!response?.ok) return null
    const bytes = await readBoundedBody(response, maxBytes).catch(() => null)
    if (!bytes) return null
    const contentType = mediaType(response.headers.get('content-type'))
    return { url: response.url || url, bytes, contentType }
  }
}

/**
 * A fetch for one page: it answers each URL it answered before from the same response, so a page
 * styled twice gets the same files both times, and holds the page's files to `maxBytes` together.
 * Past that, a file is left out as one that failed to load.
 */
export function pageResourceFetch(
  fetch: DesignResourceFetch,
  maxBytes = MAX_PAGE_RESOURCE_BYTES
): DesignResourceFetch {
  const answered = new Map<string, DesignResource>()
  let total = 0
  return async (url, signal) => {
    const known = answered.get(url)
    if (known) return known
    const fetched = await fetch(url, signal)
    if (!fetched || total + fetched.bytes.byteLength > maxBytes) return null
    total += fetched.bytes.byteLength
    answered.set(url, fetched)
    return fetched
  }
}
