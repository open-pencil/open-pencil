import 'fake-indexeddb/auto'
import { describe, expect, test } from 'bun:test'

import { binaryStorage, readStoredBinary } from '@/app/storage/idb'

const bytes = new Uint8Array([1, 2, 3, 4])

describe('IndexedDB binary values', () => {
  test('are stored as Blobs where the engine stores them', async () => {
    const stored = (await binaryStorage())(bytes)
    expect(stored).toBeInstanceOf(Blob)
    expect(await readStoredBinary(stored)).toEqual(bytes)
  })

  test('are stored from bytes over a shared buffer', async () => {
    const shared = new Uint8Array(new SharedArrayBuffer(4))
    shared.set(bytes)
    expect(await readStoredBinary((await binaryStorage())(shared))).toEqual(bytes)
  })

  test('are read in every form earlier versions stored', async () => {
    expect(await readStoredBinary(new Blob([bytes]))).toEqual(bytes)
    expect(await readStoredBinary(bytes)).toEqual(bytes)
    expect(await readStoredBinary(bytes.slice().buffer)).toEqual(bytes)
    expect(await readStoredBinary(undefined)).toBeNull()
  })
})
