import { readFigForDisplay } from '@/app/document/io/fig'
import { usablePreview } from '@/app/document/io/preview-bytes'
import { renderOffscreenPreview } from '@/app/document/io/preview-render'
import { createStorageAdapter, type StorageLocation } from '@/app/integrations/storage'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { saveStoragePreview } from '@/app/storage/workspace/save-preview'

/** Designs being drawn right now, so concurrent requests share one download. */
const inFlight = new Map<string, Promise<Uint8Array | null>>()
let queue: Promise<unknown> = Promise.resolve()

function whenIdle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: 2000 })
    } else {
      setTimeout(resolve, 0)
    }
  })
}

async function drawPreview(
  location: StorageLocation,
  id: string,
  isCurrent: () => boolean
): Promise<Uint8Array | null> {
  await whenIdle()
  if (!isCurrent()) return null
  const local = getLocalCanvasStore()
  const existing = usablePreview(await local.readThumb(id))
  if (existing) return existing
  const metadata = await local.getMeta(id)
  const localFig = metadata?.hasFig ? await local.readFig(id) : null
  if (!localFig && !isCurrent()) return null
  const figBytes = localFig ?? (await createStorageAdapter(location).getDocument(id)).bytes
  const fileBytes = Uint8Array.from(figBytes)
  const graph = await readFigForDisplay(
    new File([fileBytes.buffer], `${id}.fig`, { type: 'application/octet-stream' })
  )
  const preview = usablePreview(await renderOffscreenPreview(graph))
  if (!preview || !isCurrent()) return preview
  await saveStoragePreview(id, preview)
  return preview
}

/**
 * Draws a preview for a storage design that has none, one design at a time and only when the
 * page is idle, then keeps it locally and uploads it once. Resolves to null when it cannot.
 */
export function drawMissingStoragePreview(
  location: StorageLocation,
  id: string,
  isCurrent: () => boolean
): Promise<Uint8Array | null> {
  const key = `${location.providerId}\0${location.profileId ?? ''}\0${location.containerId ?? ''}\0${id}`
  const pending = inFlight.get(key)
  if (pending) return pending
  const drawn = queue.then(() =>
    drawPreview(location, id, isCurrent).catch((error: unknown) => {
      console.warn('[Storage] Could not draw a preview in the background', error)
      return null
    })
  )
  queue = drawn
  inFlight.set(key, drawn)
  // A drawn preview is kept locally, so a later request finds it there without a download.
  void drawn.finally(() => inFlight.delete(key))
  return drawn
}
