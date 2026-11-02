import { afterAll, afterEach, describe, expect, test } from 'bun:test'

import { IDBFactory } from 'fake-indexeddb'

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
