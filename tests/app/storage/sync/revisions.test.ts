import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  resetStorageProviderRegistryForTests,
  StorageProviderRegistry,
  StorageRevisionConflictError,
  type StorageAdapter,
  type StorageLocation
} from '@/app/integrations/storage'
import { createMemoryLocalCanvasStore, type LocalCanvasStore } from '@/app/storage/local-store'
import { resetLocalCanvasStoreForTests } from '@/app/storage/local-store/store'
import {
  createMemoryOutbox,
  getOutbox,
  keepBothVersions,
  kickSyncEngine,
  persistStorageCanvasLocally,
  replaceStoredVersion,
  resetOutboxForTests,
  takeStoredVersion
} from '@/app/storage/sync'

const location: StorageLocation = {
  providerId: 'test-provider',
  profileId: 'server-a',
  containerId: 'workspace-1'
}

/** A provider that keeps revisions and refuses writes based on a stale one, as Cloud does. */
function revisionedProvider() {
  const documents = new Map<string, { bytes: Uint8Array; revision: string; name: string }>()
  let counter = 0
  const writes: { id: string; base: string | null }[] = []
  const adapter: StorageAdapter = {
    async testConnection() {
      return { ok: true, message: '' }
    },
    async listDocuments() {
      return [...documents].map(([id, document]) => ({
        id,
        name: document.name,
        updatedAt: '',
        revision: document.revision
      }))
    },
    async getDocument(id) {
      const document = documents.get(id)
      if (!document) throw new Error('missing')
      return { bytes: document.bytes, revision: document.revision }
    },
    async putDocument(id, bytes, metadata, _progress, options) {
      const current = documents.get(id)
      const base = options?.baseRevision ?? null
      writes.push({ id, base })
      if (current && current.revision !== base) {
        throw new StorageRevisionConflictError(current.revision)
      }
      counter += 1
      documents.set(id, { bytes, revision: `r${counter}`, name: metadata.name })
      return { revision: `r${counter}` }
    },
    async deleteDocument(id) {
      documents.delete(id)
    },
    async getUsage() {
      return { bytesUsed: 0, objectCount: 0, documentCount: documents.size }
    }
  }
  return {
    adapter,
    documents,
    writes,
    /** Someone else saves a new revision on the provider. */
    saveElsewhere(id: string, bytes: Uint8Array) {
      counter += 1
      const name = documents.get(id)?.name ?? id
      documents.set(id, { bytes, revision: `r${counter}`, name })
    }
  }
}

let store: LocalCanvasStore
let provider: ReturnType<typeof revisionedProvider>

beforeEach(() => {
  store = createMemoryLocalCanvasStore()
  provider = revisionedProvider()
  resetLocalCanvasStoreForTests(store)
  resetOutboxForTests(createMemoryOutbox())
  resetStorageProviderRegistryForTests(
    new StorageProviderRegistry([
      {
        id: location.providerId,
        label: 'Test provider',
        description: '',
        preferenceFields: [],
        credentialFields: [],
        createAdapter: () => provider.adapter
      }
    ])
  )
})

afterEach(() => {
  resetLocalCanvasStoreForTests()
  resetOutboxForTests()
  resetStorageProviderRegistryForTests()
})

async function save(canvasId: string, bytes: number[], name = 'Design') {
  await persistStorageCanvasLocally({
    ...location,
    canvasId,
    name,
    figBytes: new Uint8Array(bytes)
  })
  await drain()
}

/** Runs the sync engine until the outbox has no work it can do now. */
async function drain() {
  for (let round = 0; round < 200; round++) {
    await kickSyncEngine()
    const ready = (await getOutbox().list()).filter((job) => job.nextAttemptAt <= Date.now())
    if (ready.length === 0) return
    // A pump already in flight owns the queue; let it finish before checking again.
    await new Promise((resolve) => {
      setTimeout(resolve, 1)
    })
  }
  throw new Error('The sync engine did not settle')
}

describe('storage revisions', () => {
  test('uploads each edit on top of the revision the previous upload created', async () => {
    await save('canvas-1', [1])
    await save('canvas-1', [1, 2])

    expect(provider.writes).toEqual([
      { id: 'canvas-1', base: null },
      { id: 'canvas-1', base: 'r1' }
    ])
    expect(await store.getMeta('canvas-1')).toMatchObject({
      syncStatus: 'synced',
      remoteRevision: 'r2',
      profileId: 'server-a',
      containerId: 'workspace-1'
    })
  })

  test('keeps both versions and waits for a choice when someone else saved first', async () => {
    await save('canvas-1', [1])
    provider.saveElsewhere('canvas-1', new Uint8Array([9]))
    await save('canvas-1', [1, 2])
    await save('canvas-2', [5])

    expect(await store.getMeta('canvas-1')).toMatchObject({
      syncStatus: 'conflict',
      remoteRevision: 'r1',
      conflictRevision: 'r2'
    })
    expect([...((await store.readFig('canvas-1')) ?? [])]).toEqual([1, 2])
    expect([...(provider.documents.get('canvas-1')?.bytes ?? [])]).toEqual([9])
    expect(await store.getMeta('canvas-2')).toMatchObject({ syncStatus: 'synced' })
    const parked = (await getOutbox().list()).filter((job) => job.canvasId === 'canvas-1')
    expect(parked.map((job) => job.nextAttemptAt)).toEqual([Number.MAX_SAFE_INTEGER])
  })

  test('taking the stored version discards local edits and their pending upload', async () => {
    await save('canvas-1', [1])
    provider.saveElsewhere('canvas-1', new Uint8Array([9]))
    await save('canvas-1', [1, 2])

    await takeStoredVersion('canvas-1')

    expect([...((await store.readFig('canvas-1')) ?? [])]).toEqual([9])
    expect(await store.getMeta('canvas-1')).toMatchObject({
      syncStatus: 'synced',
      remoteRevision: 'r2',
      conflictRevision: null
    })
    expect(await getOutbox().list()).toEqual([])
  })

  test('keeping both saves local edits as a new document beside the stored version', async () => {
    await save('canvas-1', [1])
    provider.saveElsewhere('canvas-1', new Uint8Array([9]))
    await save('canvas-1', [1, 2])

    const copyId = await keepBothVersions('canvas-1', 'Design (your copy)')
    await drain()

    expect(copyId).not.toBe('canvas-1')
    expect([...(provider.documents.get('canvas-1')?.bytes ?? [])]).toEqual([9])
    expect(provider.documents.get(copyId)).toMatchObject({ name: 'Design (your copy)' })
    expect([...(provider.documents.get(copyId)?.bytes ?? [])]).toEqual([1, 2])
    expect(await store.getMeta(copyId)).toMatchObject({ containerId: 'workspace-1' })
  })

  test('replacing uploads local edits over the newer stored version', async () => {
    await save('canvas-1', [1])
    provider.saveElsewhere('canvas-1', new Uint8Array([9]))
    await save('canvas-1', [1, 2])

    await replaceStoredVersion('canvas-1')
    await drain()

    expect([...(provider.documents.get('canvas-1')?.bytes ?? [])]).toEqual([1, 2])
    expect(await store.getMeta('canvas-1')).toMatchObject({
      syncStatus: 'synced',
      remoteRevision: 'r3',
      conflictRevision: null
    })
  })

  test('refuses to resolve a document that has no conflict', async () => {
    await save('canvas-1', [1])
    await expect(takeStoredVersion('canvas-1')).rejects.toThrow()
  })
})
