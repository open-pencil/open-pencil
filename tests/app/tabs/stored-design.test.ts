import { describe, expect, test } from 'bun:test'

import type { StorageDocumentBinding } from '@/app/integrations/storage'
import {
  createMemoryLocalCanvasStore,
  resetLocalCanvasStoreForTests
} from '@/app/storage/local-store'
import { hasStoredDesign, storedDesignIdOf } from '@/app/tabs/stored-design'

const CLOUD_PROVIDER = 'openpencil-cloud'

function storeBoundTo(binding: StorageDocumentBinding | null) {
  return { getStorageBinding: () => binding }
}

async function localStoreWith(id: string, providerId: string) {
  const store = createMemoryLocalCanvasStore()
  resetLocalCanvasStoreForTests(store)
  await store.writeCanvas({ id, providerId, name: 'Stored', figBytes: new Uint8Array([1]) })
  return store
}

describe('stored design address', () => {
  test('a document in the storage bucket is addressed by its stored ID', () => {
    const store = storeBoundTo({ providerId: 's3-compatible', documentId: 'doc-1' })
    expect(storedDesignIdOf(store)).toBe('doc-1')
  })

  test('a Cloud document or an unstored one has no stored address', () => {
    expect(
      storedDesignIdOf(storeBoundTo({ providerId: CLOUD_PROVIDER, documentId: 'doc-1' }))
    ).toBe(null)
    expect(storedDesignIdOf(storeBoundTo(null))).toBe(null)
  })

  test('a design this device keeps a copy of can open again', async () => {
    await localStoreWith('doc-1', 's3-compatible')
    expect(await hasStoredDesign('doc-1')).toBe(true)
    expect(await hasStoredDesign('missing')).toBe(false)
  })

  test('a deleted design or a Cloud one cannot open from its address', async () => {
    const store = await localStoreWith('doc-1', 's3-compatible')
    await store.tombstone('doc-1')
    expect(await hasStoredDesign('doc-1')).toBe(false)

    await localStoreWith('doc-2', CLOUD_PROVIDER)
    expect(await hasStoredDesign('doc-2')).toBe(false)
  })
})
