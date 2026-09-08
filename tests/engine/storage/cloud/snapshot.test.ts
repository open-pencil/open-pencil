import { afterEach, expect, test } from 'bun:test'

import type { StorageAdapter } from '@/app/integrations/storage/types'
import { storageCanvasId } from '@/app/storage/id'
import {
  createMemoryLocalCanvasStore,
  resetLocalCanvasStoreForTests
} from '@/app/storage/local-store'
import { readStorageDocument } from '@/app/tabs/open/storage'

afterEach(() => resetLocalCanvasStoreForTests())

test('replica ancestry belongs to downloaded bytes rather than a stale listing', async () => {
  const store = createMemoryLocalCanvasStore()
  resetLocalCanvasStoreForTests(store)
  const binding = {
    providerId: 'openpencil-cloud' as const,
    connectionId: 'instance',
    workspaceId: 'workspace',
    documentId: 'document'
  }
  const bytes = new Uint8Array([1, 2, 3])
  const adapter: StorageAdapter = {
    testConnection: async () => ({ ok: true, message: '' }),
    listDocuments: async () => [],
    getDocument: async () => {
      throw new Error('Unversioned download must not be used')
    },
    getDocumentSnapshot: async () => ({ bytes, remoteRevisionId: 'downloaded-revision' }),
    getUsage: async () => ({ bytesUsed: 0, objectCount: 0, documentCount: 0 }),
    putDocument: async () => undefined,
    deleteDocument: async () => undefined
  }
  const file = await readStorageDocument(
    {
      id: 'document',
      name: 'Design',
      updatedAt: '2026-01-01',
      metadataAuthoritative: true,
      remoteRevisionId: 'listed-revision'
    },
    binding,
    adapter,
    {
      id: 1,
      signal: new AbortController().signal,
      update: () => undefined,
      complete: () => undefined,
      fail: () => undefined,
      cancel: () => undefined
    }
  )
  expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes)
  expect((await store.getMeta(storageCanvasId(binding)))?.remoteRevisionId).toBe(
    'downloaded-revision'
  )
})
