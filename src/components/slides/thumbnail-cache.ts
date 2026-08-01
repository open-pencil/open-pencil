import { readStoredThumbnail, writeStoredThumbnail } from '@/components/slides/thumbnail-store'

/**
 * Rendered slide thumbnails.
 *
 * A thumbnail costs a full-page rasterisation plus a PNG encode, and the filmstrip renders
 * them lazily as they scroll into view — so without a cache, every scroll back over a slide
 * pays for it again.
 *
 * Both layers are keyed by document and page. The scene version deliberately plays no part
 * in the key: it is document-global, so putting it there meant one edit invalidated every
 * slide's thumbnail and the whole filmstrip re-rendered. It is also a runtime counter that
 * resets when a document is reopened, so it could never match across sessions anyway.
 *
 * Freshness is the caller's decision instead: it knows which page was edited and asks for
 * that one to be re-rendered.
 *
 * A stored thumbnail is therefore shown immediately but treated as possibly stale: the
 * caller gets it at once and a fresh render follows in the background. That is what makes a
 * reopened deck show its filmstrip instantly instead of rasterising every slide first.
 */
const cache = new Map<string, Blob>()
const inFlight = new Map<string, Promise<Blob | null>>()

/** Enough for a long deck's worth of slides without holding every version ever rendered. */
const MAX_ENTRIES = 120

function keyFor(documentId: string, pageId: string): string {
  return `${documentId}:${pageId}`
}

function remember(key: string, blob: Blob): void {
  cache.set(key, blob)
  // Map preserves insertion order, so the oldest key is the first one out.
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

export type SlideThumbnailResult = {
  /** Ready to show now: freshly rendered, or a stored thumbnail that may be stale. */
  blob: Blob | null
  /** Resolves with a fresh render when `blob` came from disk, otherwise null. */
  refresh: Promise<Blob | null> | null
}

function renderAndStore(
  key: string,
  stored: string,
  render: () => Promise<Blob | null>
): Promise<Blob | null> {
  const request = render()
    .then((blob) => {
      if (blob) {
        remember(key, blob)
        // Persisting is best-effort and must not delay showing the thumbnail.
        void writeStoredThumbnail(stored, blob)
      }
      return blob
    })
    .finally(() => inFlight.delete(key))

  inFlight.set(key, request)
  return request
}

/**
 * The thumbnail for this page, rendering it only when neither cache can serve it.
 * Concurrent callers for the same key share one render rather than starting two.
 */
export async function getSlideThumbnail(
  documentId: string,
  pageId: string,
  render: () => Promise<Blob | null>,
  { stale = false }: { stale?: boolean } = {}
): Promise<SlideThumbnailResult> {
  const key = keyFor(documentId, pageId)

  if (stale) {
    // This slide was just edited: the cached image is known to be out of date.
    cache.delete(key)
    return { blob: await renderAndStore(key, key, render), refresh: null }
  }

  const cached = cache.get(key)
  if (cached) return { blob: cached, refresh: null }

  const pending = inFlight.get(key)
  if (pending) return { blob: await pending, refresh: null }

  const persisted = await readStoredThumbnail(key)
  if (persisted) {
    // Show it now, and correct it in the background in case it predates an edit.
    remember(key, persisted)
    return { blob: persisted, refresh: renderAndStore(key, key, render) }
  }

  return { blob: await renderAndStore(key, key, render), refresh: null }
}
