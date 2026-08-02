import type { RenderedPixels } from '@open-pencil/core/io'

import {
  LatestFirstScheduler,
  ScheduledTaskCancelledError
} from '@/app/editor/thumbnails/scheduler'
import {
  readStoredThumbnail,
  writeStoredThumbnail,
  type StoredSlideThumbnail
} from '@/app/editor/thumbnails/store'

/**
 * Rendered slide thumbnails.
 *
 * Raster work is serialized and newest-first. A fast scroll therefore cannot queue minutes
 * of obsolete main-thread work ahead of the slides where the user stops. The rendered
 * value is raw RGBA rather than PNG: encoding merely to decode into the filmstrip was the
 * dominant thumbnail cost.
 */
const cache = new Map<string, StoredSlideThumbnail>()
const inFlight = new Map<string, Promise<StoredSlideThumbnail | null>>()
const scheduler = new LatestFirstScheduler<StoredSlideThumbnail | null>()

/** Raw thumbnails are larger than PNGs, so keep a tighter in-memory working set. */
const MAX_ENTRIES = 64

function keyFor(documentId: string, pageId: string): string {
  return `${documentId}:${pageId}`
}

function remember(key: string, image: StoredSlideThumbnail): void {
  cache.delete(key)
  cache.set(key, image)
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

export function isRenderedThumbnail(image: StoredSlideThumbnail | null): image is RenderedPixels {
  return image !== null && 'pixels' in image
}

export type SlideThumbnailResult = {
  /** Ready to show now: freshly rendered, or a stored thumbnail that may be stale. */
  image: StoredSlideThumbnail | null
  /** Resolves with a fresh render when `image` came from disk, otherwise null. */
  refresh: Promise<StoredSlideThumbnail | null> | null
}

function renderAndStore(
  key: string,
  render: () => Promise<StoredSlideThumbnail | null>,
  signal?: AbortSignal
): Promise<StoredSlideThumbnail | null> {
  const request = scheduler
    .schedule(render, signal)
    .then((image) => {
      if (image) {
        remember(key, image)
        // IndexedDB structured-clones the pixels. Persistence is best-effort and must not
        // delay the thumbnail appearing.
        void writeStoredThumbnail(key, image)
      }
      return image
    })
    .catch((error: unknown) => {
      if (error instanceof ScheduledTaskCancelledError) return null
      throw error
    })
    .finally(() => {
      if (inFlight.get(key) === request) inFlight.delete(key)
    })

  inFlight.set(key, request)
  return request
}

/** Pause low-priority filmstrip raster work while the same renderer drives an audience. */
export function setSlideThumbnailRenderingPaused(paused: boolean): void {
  scheduler.setPaused(paused)
}

/**
 * The thumbnail for this page, rendering it only when neither cache can serve it.
 * Concurrent callers for the same key share one render rather than starting two.
 */
export async function getSlideThumbnail(
  documentId: string,
  pageId: string,
  render: () => Promise<StoredSlideThumbnail | null>,
  { stale = false, signal }: { stale?: boolean; signal?: AbortSignal } = {}
): Promise<SlideThumbnailResult> {
  const key = keyFor(documentId, pageId)
  if (signal?.aborted) return { image: null, refresh: null }

  if (stale) {
    cache.delete(key)
    return { image: await renderAndStore(key, render, signal), refresh: null }
  }

  const cached = cache.get(key)
  if (cached) {
    // Refresh recency as well as returning the cached object.
    remember(key, cached)
    return { image: cached, refresh: null }
  }

  const pending = inFlight.get(key)
  if (pending) return { image: await pending, refresh: null }

  const persisted = await readStoredThumbnail(key)
  if (signal?.aborted) return { image: null, refresh: null }
  if (persisted) {
    // Show it now, and correct it in the background in case it predates an edit.
    remember(key, persisted)
    return { image: persisted, refresh: renderAndStore(key, render, signal) }
  }

  return { image: await renderAndStore(key, render, signal), refresh: null }
}
