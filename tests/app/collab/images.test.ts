import { describe, expect, test } from 'bun:test'

import { noop } from 'es-toolkit'
import * as Y from 'yjs'

import { bindRoomImages, type RoomImageStore } from '@/app/collab/images'
import type { EditorStore } from '@/app/editor/active-store'

import { asDouble } from '#tests/helpers/doubles'

/** A store that keeps images by a reference of its own, counting what it was asked. */
function memoryImageStore(canStore = true, failStoring = false) {
  const kept = new Map<string, Uint8Array>()
  const calls = { stored: 0, loaded: 0 }
  const store: RoomImageStore = {
    canStore,
    async store(images) {
      calls.stored++
      if (failStoring) throw new Error('Storage is down')
      return new Map(
        images.map((image) => {
          const ref = `ref:${image.name}`
          kept.set(ref, image.bytes)
          return [image.name, ref]
        })
      )
    },
    async load(refs) {
      calls.loaded++
      return new Map(
        refs.flatMap(({ name, ref }) => {
          const bytes = kept.get(ref)
          return bytes ? [[name, bytes] as const] : []
        })
      )
    }
  }
  return { store, kept, calls }
}

/** A peer of a room: its document and the images its editor holds. */
function peer(images: RoomImageStore, retryDelayMs?: (attempt: number) => number) {
  const ydoc = new Y.Doc()
  const graphImages = new Map<string, Uint8Array>()
  let renders = 0
  const reports: string[] = []
  const editor = asDouble<EditorStore>({
    graph: { images: graphImages },
    requestRender: () => {
      renders++
    }
  })
  const bound = bindRoomImages({
    ydoc,
    yimages: ydoc.getMap<Uint8Array>('images'),
    yrefs: ydoc.getMap<string>('imageRefs'),
    store: editor,
    images,
    report: (message) => {
      reports.push(message)
    },
    retryDelayMs
  })
  return { ydoc, graphImages, bound, reports, renders: () => renders }
}

/** Lets queued stores and loads finish. */
async function settle() {
  for (let index = 0; index < 10; index++) await Promise.resolve()
}

/** Lets a retry's timer fire and the load it starts finish. */
async function afterRetry() {
  await new Promise((resolve) => {
    setTimeout(resolve, 1)
  })
  await settle()
}

/** Sends everything `from` has that `to` lacks, as the relay would. */
function sync(from: Y.Doc, to: Y.Doc) {
  Y.applyUpdate(to, Y.encodeStateAsUpdate(from, Y.encodeStateVector(to)))
}

const photo = new Uint8Array([137, 80, 78, 71, 1, 2, 3])

describe('room images', () => {
  test('a peer that may store an image names it by reference instead of sending its bytes', async () => {
    const images = memoryImageStore()
    const editor = peer(images.store)
    expect(editor.bound.share('a1', photo)).toBe(true)
    await settle()
    expect(editor.ydoc.getMap<string>('imageRefs').get('a1')).toBe('ref:a1')
    expect(editor.ydoc.getMap('images').has('a1')).toBe(false)

    // Another peer loads it from the reference.
    const loader = peer(images.store)
    sync(editor.ydoc, loader.ydoc)
    await settle()
    expect(loader.graphImages.get('a1')).toEqual(photo)
    expect(loader.renders()).toBeGreaterThan(0)
  })

  test('bytes a guest puts in the room are stored and swapped for a reference', async () => {
    const images = memoryImageStore()
    const guest = peer(memoryImageStore(false).store)
    expect(guest.bound.share('g1', photo)).toBe(false)
    guest.ydoc.getMap<Uint8Array>('images').set('g1', photo)

    const editor = peer(images.store)
    sync(guest.ydoc, editor.ydoc)
    await settle()
    expect(editor.ydoc.getMap<string>('imageRefs').get('g1')).toBe('ref:g1')
    expect(editor.ydoc.getMap('images').has('g1')).toBe(false)
    expect(images.calls.stored).toBe(1)
  })

  test('an image the store refused stays in the room as bytes', async () => {
    const editor = peer(memoryImageStore(true, true).store)
    editor.bound.share('a1', photo)
    await settle()
    expect(editor.ydoc.getMap<Uint8Array>('images').get('a1')).toEqual(photo)
    expect(editor.ydoc.getMap('imageRefs').has('a1')).toBe(false)
    expect(editor.reports).toHaveLength(1)
  })

  test('an image that fails to load, or is left out, is asked for again until it loads', async () => {
    const images = memoryImageStore()
    const editor = peer(images.store)
    editor.bound.share('a1', photo)
    await settle()
    const load = images.store.load.bind(images.store)
    let failures = 2
    const flaky: RoomImageStore = {
      ...images.store,
      async load(refs) {
        failures--
        if (failures === 1) throw new Error('Network is down')
        if (failures === 0) return new Map()
        return load(refs)
      }
    }
    const loader = peer(flaky, () => 0)
    sync(editor.ydoc, loader.ydoc)
    await settle()
    expect(loader.graphImages.has('a1')).toBe(false)
    expect(loader.reports).toEqual(['Loading room images failed'])
    await afterRetry()
    expect(loader.graphImages.has('a1')).toBe(false)
    await afterRetry()
    expect(loader.graphImages.get('a1')).toEqual(photo)
  })

  test('a peer that leaves the room stops asking for images it could not load', async () => {
    let loads = 0
    const missing: RoomImageStore = {
      canStore: false,
      store: async () => new Map(),
      load: async () => {
        loads++
        return new Map()
      }
    }
    const loader = peer(missing, () => 0)
    loader.ydoc.getMap<string>('imageRefs').set('a1', 'ref:a1')
    await settle()
    expect(loads).toBe(1)
    loader.bound.dispose()
    await afterRetry()
    expect(loads).toBe(1)
  })

  describe('a room that closes while storing', () => {
    /** One tab whose rooms come and go, as a room that starts over does. */
    function tab() {
      const editor = asDouble<EditorStore>({
        graph: { images: new Map<string, Uint8Array>() },
        requestRender: () => undefined
      })
      return (images: RoomImageStore) => {
        const ydoc = new Y.Doc()
        const bound = bindRoomImages({
          ydoc,
          yimages: ydoc.getMap<Uint8Array>('images'),
          yrefs: ydoc.getMap<string>('imageRefs'),
          store: editor,
          images,
          report: () => undefined
        })
        return { ydoc, bound }
      }
    }

    test("stores an image whose upload ended after it closed in the tab's next room", async () => {
      const images = memoryImageStore()
      let land: () => void = noop
      const slow: RoomImageStore = {
        ...images.store,
        async store(batch) {
          await new Promise<void>((resolve) => {
            land = resolve
          })
          return images.store.store(batch)
        }
      }
      const open = tab()
      const first = open(slow)
      first.bound.share('a1', photo)
      await settle()
      first.bound.dispose()
      const next = open(images.store)
      land()
      await settle()
      expect(next.ydoc.getMap<string>('imageRefs').get('a1')).toBe('ref:a1')
    })

    test("stores an image in the next room's own store, as another workspace's would be", async () => {
      const open = tab()
      const first = open(memoryImageStore().store)
      first.bound.share('a1', photo)
      first.bound.dispose()
      const other = memoryImageStore()
      const next = open(other.store)
      await settle()
      expect(next.ydoc.getMap<string>('imageRefs').get('a1')).toBe('ref:a1')
      expect(other.kept.get('ref:a1')).toEqual(photo)
    })

    test("stores an image it never sent in the tab's next room", async () => {
      const images = memoryImageStore()
      const open = tab()
      const first = open(images.store)
      first.bound.share('a1', photo)
      first.bound.dispose()
      const next = open(images.store)
      await settle()
      expect(next.ydoc.getMap<string>('imageRefs').get('a1')).toBe('ref:a1')
      expect(images.calls.stored).toBe(1)
    })

    test('leaves the bytes in a next room this peer cannot store in', async () => {
      const open = tab()
      const first = open(memoryImageStore().store)
      first.bound.share('a1', photo)
      first.bound.dispose()
      const next = open(memoryImageStore(false).store)
      await settle()
      expect(next.ydoc.getMap<Uint8Array>('images').get('a1')).toEqual(photo)
    })
  })
})
