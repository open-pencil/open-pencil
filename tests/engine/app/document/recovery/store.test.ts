import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, test } from 'bun:test'

import { createIdbRecoveryStore } from '@/app/document/recovery/idb'
import { createMemoryRecoveryStore } from '@/app/document/recovery/memory'

const bytes = new Uint8Array([1, 2, 3, 4])

describe('document recovery store', () => {
  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('open-pencil-recovery')
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
      request.onblocked = () => resolve()
    })
  })

  test('stores metadata and FIG bytes atomically in IndexedDB', async () => {
    const store = createIdbRecoveryStore()
    const metadata = await store.write({
      id: 'recovery-1',
      documentName: 'Agent draft',
      sceneVersion: 12,
      figBytes: bytes
    })

    expect(metadata).toMatchObject({
      id: 'recovery-1',
      documentName: 'Agent draft',
      sceneVersion: 12,
      byteLength: 4,
      formatVersion: 1
    })
    expect(await store.list()).toEqual([metadata])
    expect(await store.read('recovery-1')).toEqual({ ...metadata, figBytes: bytes })

    await store.remove('recovery-1')
    expect(await store.list()).toEqual([])
    expect(await store.read('recovery-1')).toBeNull()
  })

  test('memory store owns input and output bytes', async () => {
    const store = createMemoryRecoveryStore()
    const input = new Uint8Array(bytes)
    await store.write({ id: 'one', documentName: 'Draft', sceneVersion: 1, figBytes: input })
    input[0] = 99

    const first = await store.read('one')
    expect(first?.figBytes[0]).toBe(1)
    if (first) first.figBytes[0] = 88
    expect((await store.read('one'))?.figBytes[0]).toBe(1)
  })
})
