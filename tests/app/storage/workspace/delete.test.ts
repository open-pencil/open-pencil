import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { recentDocuments, rememberRecentStorageDocument } from '@/app/recent-files'
import { createMemoryLocalCanvasStore, type LocalCanvasStore } from '@/app/storage/local-store'
import { resetLocalCanvasStoreForTests } from '@/app/storage/local-store/store'
import { createMemoryOutbox, getOutbox, resetOutboxForTests } from '@/app/storage/sync'
import { deleteStoredDocument } from '@/app/storage/workspace/delete'
import { onStorageWorkspaceEvent } from '@/app/storage/workspace/events'
import { closeTab, createTab, getTabsSnapshot } from '@/app/tabs'

const BUCKET = { providerId: 's3-compatible' }
const CLOUD = { providerId: 'cloud', profileId: 'server', containerId: 'workspace' }
const POSTER = { id: 'poster', name: 'Poster', updatedAt: '2026-10-01T00:00:00.000Z' }

let store: LocalCanvasStore
let recentBefore: typeof recentDocuments.value

const recentPoster = () =>
  recentDocuments.value.some(
    (document) => document.kind === 'storage' && document.documentId === POSTER.id
  )

beforeEach(() => {
  // Recent files live in shared storage; each test starts from none and leaves them as it found them.
  recentBefore = recentDocuments.value
  recentDocuments.value = []
  store = createMemoryLocalCanvasStore()
  resetLocalCanvasStoreForTests(store)
  resetOutboxForTests(createMemoryOutbox())
})

afterEach(() => {
  recentDocuments.value = recentBefore
  resetLocalCanvasStoreForTests()
  resetOutboxForTests()
})

describe('deleting a stored document', () => {
  test('hides it, queues its deletion, and drops it from recent files', async () => {
    await store.writeCanvas({
      id: POSTER.id,
      ...BUCKET,
      name: POSTER.name,
      figBytes: new Uint8Array([1]),
      syncStatus: 'synced'
    })
    rememberRecentStorageDocument({ ...BUCKET, documentId: POSTER.id }, POSTER.name)
    rememberRecentStorageDocument({ ...BUCKET, documentId: 'flyer' }, 'Flyer')
    expect(recentPoster()).toBe(true)
    const events: string[] = []
    const stop = onStorageWorkspaceEvent((event) =>
      events.push(`${event.kind}:${event.documentId}`)
    )

    await deleteStoredDocument(POSTER, BUCKET)
    stop()

    expect(await store.listMetas()).toEqual([])
    expect(await getOutbox().list()).toMatchObject([{ canvasId: POSTER.id, type: 'deleteCanvas' }])
    expect(recentPoster()).toBe(false)
    expect(recentDocuments.value.map((document) => document.name)).toEqual(['Flyer'])
    expect(events).toContain(`changed:${POSTER.id}`)
  })

  test('remembers where a document without a local copy lives, so its deletion reaches it', async () => {
    await deleteStoredDocument(POSTER, CLOUD)

    expect(await store.getMeta(POSTER.id)).toMatchObject({ ...CLOUD, tombstoned: true })
    expect(await getOutbox().list()).toMatchObject([{ canvasId: POSTER.id, type: 'deleteCanvas' }])
  })
  test('refuses a copy of the same ID that lives in another location', async () => {
    await store.writeCanvas({
      id: POSTER.id,
      ...BUCKET,
      name: POSTER.name,
      figBytes: new Uint8Array([1]),
      syncStatus: 'synced'
    })

    await expect(deleteStoredDocument(POSTER, CLOUD)).rejects.toThrow('another location')
    expect(await store.getMeta(POSTER.id)).toMatchObject({ ...BUCKET, tombstoned: false })
    expect(await getOutbox().list()).toEqual([])
  })

  test('shows the document again when its deletion cannot be queued', async () => {
    await store.writeCanvas({
      id: POSTER.id,
      ...BUCKET,
      name: POSTER.name,
      figBytes: new Uint8Array([1]),
      syncStatus: 'synced'
    })
    const outbox = createMemoryOutbox()
    resetOutboxForTests({
      ...outbox,
      enqueue: () => Promise.reject(new Error('quota exceeded'))
    })

    await expect(deleteStoredDocument(POSTER, BUCKET)).rejects.toThrow('quota exceeded')
    expect(await store.listMetas()).toMatchObject([{ id: POSTER.id, syncStatus: 'synced' }])
  })
  test('keeps an earlier deletion hidden when a repeated one cannot be queued', async () => {
    await store.writeCanvas({
      id: POSTER.id,
      ...BUCKET,
      name: POSTER.name,
      figBytes: new Uint8Array([1]),
      syncStatus: 'synced'
    })
    await store.tombstone(POSTER.id)
    resetOutboxForTests({
      ...createMemoryOutbox(),
      enqueue: () => Promise.reject(new Error('quota exceeded'))
    })

    await expect(deleteStoredDocument(POSTER, BUCKET)).rejects.toThrow('quota exceeded')
    expect(await store.getMeta(POSTER.id)).toMatchObject({ tombstoned: true })
  })
  test("closes this document's tabs and leaves other tabs open", async () => {
    const deleted = createTab()
    deleted.store.setStorageDocumentSource({ ...BUCKET, documentId: POSTER.id }, POSTER.name)
    const other = createTab()
    other.store.setStorageDocumentSource({ ...BUCKET, documentId: 'flyer' }, 'Flyer')

    await deleteStoredDocument(POSTER, BUCKET)

    const open = getTabsSnapshot().map((tab) => tab.id)
    expect(open).not.toContain(deleted.id)
    expect(open).toContain(other.id)
    await closeTab(other.id, 'discard')
  })
})
