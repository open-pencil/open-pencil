import { readStoredThumbnail, writeStoredThumbnail } from '@/components/slides/thumbnail-store'

/**
 * Rendered slide thumbnails.
 *
 * A thumbnail costs a full-page rasterisation plus a PNG encode, and the filmstrip renders
 * them lazily as they scroll into view — so without a cache, every scroll back over a slide
 * pays for it again.
 *
 * Two layers, keyed differently on purpose:
 *
 * - In memory, by document, page and scene version. Within a session the scene version is
 *   a meaningful counter, so an edit supersedes the entry with no explicit invalidation.
 * - On disk, by document and page only. The scene version is a runtime counter that resets
 *   when a document is reopened, so including it would guarantee a miss on every load, and
 *   comparing it across sessions cannot tell whether the content actually changed.
 *
 * A stored thumbnail is therefore shown immediately but treated as possibly stale: the
 * caller gets it at once and a fresh render follows in the background. That is what makes a
 * reopened deck show its filmstrip instantly instead of rasterising every slide first.
 */
const cache = new Map<string, Blob>()
const inFlight = new Map<string, Promise<Blob | null>>()

/** Enough for a long deck's worth of slides without holding every version ever rendered. */
const MAX_ENTRIES = 120

function memoryKey(documentId: string, pageId: string, sceneVersion: number): string {
  return `${documentId}:${pageId}:${sceneVersion}`
}

function storageKey(documentId: string, pageId: string): string {
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
  sceneVersion: number,
  render: () => Promise<Blob | null>
): Promise<SlideThumbnailResult> {
  const key = memoryKey(documentId, pageId, sceneVersion)
  const cached = cache.get(key)
  if (cached) return { blob: cached, refresh: null }

  const pending = inFlight.get(key)
  if (pending) return { blob: await pending, refresh: null }

  const stored = storageKey(documentId, pageId)
  const persisted = await readStoredThumbnail(stored)
  if (persisted) {
    // Show it now, and correct it if the slide has changed since it was stored.
    remember(key, persisted)
    return { blob: persisted, refresh: renderAndStore(key, stored, render) }
  }

  return { blob: await renderAndStore(key, stored, render), refresh: null }
}
