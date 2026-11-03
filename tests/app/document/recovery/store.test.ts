import 'fake-indexeddb/auto'
import { afterAll, afterEach, describe, expect, test } from 'bun:test'

import { IDBFactory } from 'fake-indexeddb'

import { createIdbRecoveryStore } from '@/app/document/recovery/idb'
import { createMemoryRecoveryStore } from '@/app/document/recovery/memory'
import {
  getRecoveryStore,
  isRecoveryStoreMemoryFallback,
  resetRecoveryStoreForTests
} from '@/app/document/recovery/store'

/** An IndexedDB that exists but fails every open, as in some private windows. */
class BrokenFactory extends IDBFactory {
  override open(): IDBOpenDBRequest {
    throw new DOMException('IndexedDB is broken', 'UnknownError')
  }
}

describe('recovery store fallback', () => {
  const sharedFactory = globalThis.indexedDB

  afterEach(() => resetRecoveryStoreForTests())
  afterAll(() => {
    globalThis.indexedDB = sharedFactory
  })

  test('a cover that cannot be read leaves the store on IndexedDB', async () => {
    globalThis.indexedDB = new BrokenFactory()
    resetRecoveryStoreForTests()
    expect(await getRecoveryStore().readCover('copy')).toBeNull()
    expect(isRecoveryStoreMemoryFallback()).toBe(false)
  })

  test('a restored copy is claimed in memory once IndexedDB has failed', async () => {
    globalThis.indexedDB = new BrokenFactory()
    resetRecoveryStoreForTests()
    const store = getRecoveryStore()
    await store.write({
      id: 'copy',
      sessionId: 'crashed',
      documentName: 'Draft',
      figBytes: new Uint8Array([1, 2, 3])
    })
    expect(isRecoveryStoreMemoryFallback()).toBe(true)

    await store.claim('copy', 'restoring')

    expect((await store.list()).map((snapshot) => snapshot.sessionId)).toEqual(['restoring'])
  })
})

describe('recovery covers', () => {
  const sharedFactory = globalThis.indexedDB
  const cover = new Uint8Array([137, 80, 78, 71])
  const figBytes = new Uint8Array([1, 2, 3])

  afterAll(() => {
    globalThis.indexedDB = sharedFactory
  })

  test.each([
    ['IndexedDB', createIdbRecoveryStore],
    ['memory', createMemoryRecoveryStore]
  ])('a %s store keeps the cover of the last write until the copy goes', async (_, create) => {
    globalThis.indexedDB = new IDBFactory()
    const store = create()
    const copy = { id: 'copy', sessionId: 'one', documentName: 'Draft', figBytes }
    await store.write({ ...copy, cover })
    expect(await store.readCover('copy')).toEqual(cover)

    await store.write(copy)
    expect(await store.readCover('copy')).toBeNull()

    await store.write({ ...copy, cover })
    await store.remove('copy')
    expect(await store.readCover('copy')).toBeNull()
  })
})
