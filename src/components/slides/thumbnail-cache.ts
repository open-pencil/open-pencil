/**
 * Rendered slide thumbnails, keyed by page and scene version.
 *
 * A thumbnail costs a full-page rasterisation plus a PNG encode. The filmstrip renders
 * them lazily as they scroll into view, so without a cache every scroll back over a slide
 * pays for it again — on a long deck that is most of what scrolling does.
 *
 * The scene version is part of the key, so an edit naturally supersedes the old entry
 * rather than needing explicit invalidation.
 */
const cache = new Map<string, Blob>()
const inFlight = new Map<string, Promise<Blob | null>>()

/** Enough for a long deck's worth of slides without holding every version ever rendered. */
const MAX_ENTRIES = 120

function keyFor(pageId: string, sceneVersion: number): string {
  return `${pageId}:${sceneVersion}`
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

/**
 * The thumbnail for this page at this scene version, rendering it only if it is not
 * already cached or being rendered for another component.
 */
export async function getSlideThumbnail(
  pageId: string,
  sceneVersion: number,
  render: () => Promise<Blob | null>
): Promise<Blob | null> {
  const key = keyFor(pageId, sceneVersion)
  const cached = cache.get(key)
  if (cached) return cached

  const pending = inFlight.get(key)
  if (pending) return pending

  const request = render()
    .then((blob) => {
      if (blob) remember(key, blob)
      return blob
    })
    .finally(() => inFlight.delete(key))

  inFlight.set(key, request)
  return request
}
