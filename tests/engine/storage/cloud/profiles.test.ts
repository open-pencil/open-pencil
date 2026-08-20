import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  cloudConnectionWorkSummary,
  hasPendingCloudConnectionWork
} from '@/app/integrations/storage/cloud/pending-work'
import {
  activeCloudConnectionProfile,
  connectCloudProfile,
  disconnectCloudProfile,
  listCloudConnectionProfiles,
  selectCloudConnectionProfile,
  updateCloudConnectionWorkspace
} from '@/app/integrations/storage/cloud/profiles'
import {
  createMemoryLocalCanvasStore,
  resetLocalCanvasStoreForTests
} from '@/app/storage/local-store'
import { createMemoryOutbox, resetOutboxForTests } from '@/app/storage/sync/outbox'

class MemoryStorage implements Storage {
  #values = new Map<string, string>()
  get length() {
    return this.#values.size
  }
  clear() {
    this.#values.clear()
  }
  getItem(key: string) {
    return this.#values.get(key) ?? null
  }
  key(index: number) {
    return [...this.#values.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.#values.delete(key)
  }
  setItem(key: string, value: string) {
    this.#values.set(key, value)
  }
}

beforeEach(() => {
  Object.assign(globalThis, { localStorage: new MemoryStorage() })
  resetLocalCanvasStoreForTests(createMemoryLocalCanvasStore())
  resetOutboxForTests(createMemoryOutbox())
})

afterEach(() => {
  resetLocalCanvasStoreForTests()
  resetOutboxForTests()
})

describe('Cloud connection profiles', () => {
  test('uses stable collision-resistant IDs across disconnect and reconnect', async () => {
    const first = await connectCloudProfile({
      kind: 'self-hosted',
      serverURL: 'https://pencil.example.com/'
    })
    updateCloudConnectionWorkspace(first.id, 'workspace-1')
    disconnectCloudProfile(first.id)
    expect(listCloudConnectionProfiles()).toContainEqual({
      ...first,
      selectedWorkspaceId: 'workspace-1'
    })

    const reconnected = await connectCloudProfile({
      kind: 'self-hosted',
      serverURL: 'https://pencil.example.com'
    })
    expect(reconnected.id).toBe(first.id)
    expect(reconnected.id).toMatch(/^cloud-[\w-]{43}$/)
    expect(activeCloudConnectionProfile()?.id).toBe(first.id)

    const other = await connectCloudProfile({
      kind: 'self-hosted',
      serverURL: 'https://other.example.com'
    })
    expect(other.id).not.toBe(first.id)
    selectCloudConnectionProfile(first.id)
    expect(activeCloudConnectionProfile()?.selectedWorkspaceId).toBe('workspace-1')
  })

  test('summarizes only work owned by one connection', async () => {
    const store = createMemoryLocalCanvasStore()
    const outbox = createMemoryOutbox()
    resetLocalCanvasStoreForTests(store)
    resetOutboxForTests(outbox)
    await store.writeCanvas({
      id: 'canvas-a',
      providerId: 'openpencil-cloud',
      documentId: 'document-a',
      connectionId: 'connection-a',
      workspaceId: 'workspace-a',
      name: 'Pending',
      figBytes: new Uint8Array([1]),
      syncStatus: 'pending'
    })
    await store.writeCanvas({
      id: 'canvas-b',
      providerId: 'openpencil-cloud',
      documentId: 'document-b',
      connectionId: 'connection-b',
      workspaceId: 'workspace-b',
      name: 'Other',
      figBytes: new Uint8Array([2]),
      syncStatus: 'error'
    })
    await outbox.enqueue({ canvasId: 'canvas-a', type: 'putCanvas', revision: 1 })
    const summary = await cloudConnectionWorkSummary('connection-a')
    expect(summary).toEqual({
      pendingDocuments: 1,
      conflictingDocuments: 0,
      failedDocuments: 0,
      queuedJobs: 1
    })
    expect(hasPendingCloudConnectionWork(summary)).toBe(true)
  })
})
