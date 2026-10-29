import { compact, partition } from 'es-toolkit'
import type * as Y from 'yjs'

import type { EditorStore } from '@/app/editor/active-store'

/**
 * Where a room keeps its images instead of in its document, as a Cloud room keeps them in its
 * workspace. The document then names each image by reference, so the room's state and what a
 * newcomer receives stay small however many images it holds.
 */
export interface RoomImageStore {
  /** Whether this peer may store images; a guest or a viewer leaves the ones it adds in the room. */
  readonly canStore: boolean
  /** Stores images and returns the reference to each, by name. */
  store(
    images: readonly { name: string; bytes: Uint8Array }[]
  ): Promise<ReadonlyMap<string, string>>
  /** The bytes behind references, by name; ones the store cannot give are left out. */
  load(refs: readonly { name: string; ref: string }[]): Promise<ReadonlyMap<string, Uint8Array>>
}

/** How long a peer waits before asking again for an image it could not load, by attempt. */
export function imageRetryDelayMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 60_000)
}

/**
 * Images a tab's closed room was still storing, by name, for the tab's next room to store and
 * name. A room closes while an upload is in flight when it starts over, as after a restore or a
 * refused join. The bytes go along, not the reference: the next room may be another workspace's,
 * and storing what its workspace already holds uploads nothing.
 */
const handedOver = new WeakMap<EditorStore, Map<string, Uint8Array>>()
/** Each tab's open room, so an upload that ends after its room closed reaches the next one. */
const openRooms = new WeakMap<EditorStore, { take: (images: Map<string, Uint8Array>) => void }>()

/** Gives the tab's next room the images a closed room was still storing. */
function handOver(store: EditorStore, images: Iterable<readonly [string, Uint8Array]>) {
  const pending = handedOver.get(store) ?? new Map<string, Uint8Array>()
  for (const [name, bytes] of images) pending.set(name, bytes)
  const room = openRooms.get(store)
  if (room) room.take(pending)
  else handedOver.set(store, pending)
}

/** The room's image references by name, beside the `images` map of bytes. */
export type YImageRefs = Y.Map<string>

export type RoomImages = {
  /** Takes an image this peer added to store and name; false leaves it for the room's bytes. */
  share(name: string, bytes: Uint8Array): boolean
  /** Whether the room names this image by reference, so removing its bytes keeps the image. */
  hasRef(name: string): boolean
  dispose(): void
}

/**
 * Keeps a room's images in `images`: a peer that may store them stores what it adds and names it
 * by reference, and stores the bytes others put in the room, such as a guest's, swapping them for
 * references; every peer loads the images references name that it lacks.
 */
export function bindRoomImages({
  ydoc,
  yimages,
  yrefs,
  store,
  images,
  report,
  retryDelayMs = imageRetryDelayMs
}: {
  ydoc: Y.Doc
  yimages: Y.Map<Uint8Array>
  yrefs: YImageRefs
  store: EditorStore
  images: RoomImageStore
  report: (message: string, error: unknown) => void
  retryDelayMs?: (attempt: number) => number
}): RoomImages {
  const toStore = new Map<string, Uint8Array>()
  const toLoad = new Set<string>()
  /** Images on their way to or from the store, so none is asked for twice at once. */
  const busy = new Set<string>()
  /** Failed loads so far by name, and the timers that will ask for those images again. */
  const attempts = new Map<string, number>()
  const retries = new Set<ReturnType<typeof setTimeout>>()
  let scheduled = false
  let disposed = false

  function soon() {
    if (scheduled || disposed) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      void flush()
    })
  }

  async function storeQueued() {
    const batch = [...toStore].map(([name, bytes]) => ({ name, bytes }))
    toStore.clear()
    if (batch.length === 0) return
    for (const image of batch) busy.add(image.name)
    try {
      const refs = await images.store(batch)
      if (disposed) {
        handOver(
          store,
          batch.map((image) => [image.name, image.bytes] as const)
        )
        return
      }
      ydoc.transact(() => {
        for (const [name, ref] of refs) {
          yrefs.set(name, ref)
          if (yimages.has(name)) yimages.delete(name)
        }
      })
    } catch (error) {
      if (disposed) {
        handOver(
          store,
          batch.map((image) => [image.name, image.bytes] as const)
        )
        return
      }
      // The bytes stay in the room, as a peer that cannot store images leaves them.
      for (const image of batch) {
        if (!yimages.has(image.name) && !yrefs.has(image.name)) {
          yimages.set(image.name, image.bytes)
        }
      }
      report('Storing room images failed', error)
    } finally {
      for (const image of batch) busy.delete(image.name)
    }
  }

  async function loadQueued() {
    const batch = compact(
      [...toLoad].map((name) => {
        const ref = yrefs.get(name)
        return ref ? { name, ref } : undefined
      })
    )
    toLoad.clear()
    if (batch.length === 0) return
    for (const image of batch) busy.add(image.name)
    let loaded: ReadonlyMap<string, Uint8Array> = new Map()
    try {
      loaded = await images.load(batch)
      if (disposed) return
      for (const [name, bytes] of loaded) store.graph.images.set(name, bytes)
      if (loaded.size > 0) store.requestRender()
    } catch (error) {
      report('Loading room images failed', error)
    } finally {
      for (const image of batch) busy.delete(image.name)
    }
    const [arrived, missed] = partition(batch, (image) => loaded.has(image.name))
    for (const image of arrived) attempts.delete(image.name)
    for (const image of missed) retryLoad(image.name, image.ref)
  }

  /** Asks again later for an image a load left out, as long as the room still names it so. */
  function retryLoad(name: string, ref: string) {
    if (disposed) return
    const attempt = attempts.get(name) ?? 0
    attempts.set(name, attempt + 1)
    const timer = setTimeout(() => {
      retries.delete(timer)
      if (!disposed && yrefs.get(name) === ref) wantLoad(name)
    }, retryDelayMs(attempt))
    retries.add(timer)
  }

  async function flush() {
    await Promise.all([storeQueued(), loadQueued()])
  }

  function wantLoad(name: string) {
    if (busy.has(name) || store.graph.images.has(name)) return
    toLoad.add(name)
    soon()
  }

  function wantStore(name: string, bytes: Uint8Array) {
    if (!images.canStore || busy.has(name) || yrefs.has(name)) return
    toStore.set(name, bytes)
    soon()
  }

  function onRefs(event: Y.YMapEvent<string>) {
    for (const [name, change] of event.changes.keys) {
      attempts.delete(name)
      if (change.action !== 'delete') wantLoad(name)
    }
  }

  function onImages(event: Y.YMapEvent<Uint8Array>) {
    for (const [name, change] of event.changes.keys) {
      const bytes = change.action === 'delete' ? undefined : yimages.get(name)
      if (bytes) wantStore(name, bytes)
    }
  }

  /** Stores and names the images a closed room was still storing. */
  function take(pending: Map<string, Uint8Array>) {
    handedOver.delete(store)
    for (const [name, bytes] of pending) {
      if (images.canStore) wantStore(name, bytes)
      // A room this peer cannot store in carries the bytes, as a guest's images travel.
      else if (!yrefs.has(name) && !yimages.has(name)) yimages.set(name, bytes)
    }
  }

  yrefs.observe(onRefs)
  yimages.observe(onImages)
  openRooms.set(store, { take })
  const pending = handedOver.get(store)
  if (pending) take(pending)
  for (const name of yrefs.keys()) wantLoad(name)
  for (const [name, bytes] of yimages) wantStore(name, bytes)

  return {
    share(name, bytes) {
      if (!images.canStore) return false
      wantStore(name, bytes)
      return true
    },
    hasRef: (name) => yrefs.has(name),
    dispose() {
      disposed = true
      if (openRooms.get(store)?.take === take) openRooms.delete(store)
      // Images queued but not yet sent to the store go to the tab's next room.
      if (toStore.size > 0) handOver(store, toStore)
      toStore.clear()
      for (const timer of retries) clearTimeout(timer)
      retries.clear()
      yrefs.unobserve(onRefs)
      yimages.unobserve(onImages)
    }
  }
}
