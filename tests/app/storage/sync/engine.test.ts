import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  bodyKey,
  documentFigKey,
  documentHeadKey,
  documentMetaKey
} from '@/app/integrations/storage/namespace'
import {
  COMMIT_SPACING_MS,
  MIN_COMMIT_GAP_MS,
  StorageSyncBlockedError
} from '@/app/storage/sync/engine'
import { persistStorageCanvasLocally } from '@/app/storage/sync/persist'

import { figArchive, writtenFor } from '#tests/helpers/storage/documents'
import {
  DESTINATION,
  PROVIDER,
  createSyncHarness,
  type SyncHarness
} from '#tests/helpers/storage/sync-harness'

let harness: SyncHarness

afterEach(() => {
  harness.dispose()
})

function save(name: string, bytes: Uint8Array, id = 'doc') {
  return persistStorageCanvasLocally(
    { providerId: PROVIDER, canvasId: id, name, figBytes: bytes },
    {
      store: harness.store,
      enqueueCanvas: (canvasId, revision) =>
        harness.engine.enqueue(canvasId, 'putCanvas', revision),
      enqueueMetadata: (canvasId, revision) =>
        harness.engine.enqueue(canvasId, 'putMetadata', revision)
    }
  )
}

function requests(method: string, prefix = 'open_pencil_storage/') {
  return harness.bucket.requests.filter(
    (request) => request.method === method && request.key.startsWith(prefix)
  )
}

/** Another device commits a version of the design. */
async function commitElsewhere(name: string, bytes: Uint8Array, id = 'doc') {
  const written = await writtenFor(name, bytes)
  await harness.adapter.putDocumentVersion(id, bytes, async () => written)
  return written
}

describe('versioned sync engine', () => {
  beforeEach(() => {
    harness = createSyncHarness()
  })

  test('a first save commits body, manifest and head and confirms the row', async () => {
    await save('Doc', figArchive('v1'))
    await harness.drain()

    const row = await harness.store.getMeta('doc')
    expect(row).toMatchObject({
      syncStatus: 'synced',
      versionedConfirmed: true,
      syncDestination: DESTINATION
    })
    expect(row?.syncedBodyId).toBe(row?.bodyId ?? '')
    expect(row?.baseStateId).not.toBeNull()
    expect(row?.lastPublishedStateId).toBe(row?.baseStateId ?? '')
    expect(requests('PUT')).toHaveLength(3)
    expect(requests('HEAD')).toHaveLength(0)
    expect(harness.events.map((event) => event.kind)).toContain('synced')
  })

  test('a rename commits a manifest and head, and no body bytes', async () => {
    const bytes = figArchive('v1')
    await save('Doc', bytes)
    await harness.drain()
    const bodiesBefore = requests('PUT', 'open_pencil_storage/bodies/').length

    await save('Renamed', bytes)
    expect((await harness.outbox.list()).map((job) => job.type)).toEqual(['putMetadata'])
    await harness.drain()

    expect(requests('PUT', 'open_pencil_storage/bodies/')).toHaveLength(bodiesBefore)
    expect((await harness.adapter.getDocumentMetadata?.('doc'))?.name).toBe('Renamed')
    expect((await harness.store.getMeta('doc'))?.syncStatus).toBe('synced')
  })

  test('saving the committed state again queues nothing', async () => {
    const bytes = figArchive('v1')
    await save('Doc', bytes)
    await harness.drain()

    await save('Doc', bytes)

    expect(await harness.outbox.list()).toEqual([])
    expect((await harness.store.getMeta('doc'))?.syncStatus).toBe('synced')
  })

  test('commits of one design are spaced, and a flush brings the next one forward', async () => {
    await save('Doc', figArchive('v1'))
    await harness.drain()
    const committedAt = harness.clock.now

    await save('Doc', figArchive('v2'))
    const [queued] = await harness.outbox.list()
    expect(queued?.nextAttemptAt).toBe(committedAt + COMMIT_SPACING_MS)

    await harness.engine.flush('doc')
    await harness.engine.idle()
    const [flushed] = await harness.outbox.list()
    expect(flushed?.nextAttemptAt).toBe(committedAt + MIN_COMMIT_GAP_MS)
  })

  test('a head moved by another device parks the edit as a conflict before any upload', async () => {
    await save('Doc', figArchive('v1'))
    await harness.drain()
    await commitElsewhere('Theirs', figArchive('theirs'))
    const bodiesBefore = requests('PUT', 'open_pencil_storage/bodies/').length

    await save('Doc', figArchive('mine'))
    await harness.drain()

    expect((await harness.store.getMeta('doc'))?.syncStatus).toBe('conflict')
    expect((await harness.outbox.list())[0]?.nextAttemptAt).toBe(Number.MAX_SAFE_INTEGER)
    expect(requests('PUT', 'open_pencil_storage/bodies/')).toHaveLength(bodiesBefore)
    expect(harness.events.some((event) => event.kind === 'conflict')).toBe(true)
  })

  test('a rename during the upload is in the committed manifest', async () => {
    await save('Before', figArchive('v1'))
    harness.bucket.beforePut = async (key) => {
      if (!key.startsWith('open_pencil_storage/bodies/')) return
      harness.bucket.beforePut = null
      const row = await harness.store.getMeta('doc')
      if (row) await harness.store.updateMeta('doc', { name: 'During', revision: row.revision + 1 })
    }
    await harness.drain()

    expect((await harness.adapter.getDocumentMetadata?.('doc'))?.name).toBe('During')
    // The body is confirmed by its identity even though the row moved on.
    const row = await harness.store.getMeta('doc')
    expect(row?.syncedBodyId).toBe(row?.bodyId ?? '')
  })

  test('a design synced to another bucket uploads again there instead of conflicting', async () => {
    await save('Doc', figArchive('v1'))
    await harness.drain()
    harness.destination.current = 's3-compatible#bucket-2'
    harness.bucket.objects.clear()

    await save('Doc', figArchive('v2'))
    await harness.drain()

    expect(await harness.store.getMeta('doc')).toMatchObject({
      syncStatus: 'synced',
      syncDestination: 's3-compatible#bucket-2'
    })
    expect(harness.bucket.objects.has(documentHeadKey('doc'))).toBe(true)
  })

  test('a legacy design moves to the versioned layout on its next commit', async () => {
    const legacy = figArchive('legacy')
    harness.bucket.seed(documentFigKey('doc'), legacy)
    harness.bucket.seed(documentMetaKey('doc'), JSON.stringify({ name: 'Doc', updatedAt: 'x' }))
    await harness.store.writeCanvas({
      id: 'doc',
      providerId: PROVIDER,
      name: 'Doc',
      figBytes: legacy,
      syncStatus: 'synced'
    })

    await harness.engine.enqueue('doc', 'putCanvas', 1)
    await harness.drain()

    const row = await harness.store.getMeta('doc')
    expect(row?.versionedConfirmed).toBe(true)
    expect(harness.bucket.objects.has(bodyKey(row?.bodyId ?? ''))).toBe(true)
    expect(harness.bucket.objects.has(documentFigKey('doc'))).toBe(true)
  })
})

describe('unconfigured storage', () => {
  test('parks work without a failure, and resume runs it once storage is set up', async () => {
    let configured = false
    harness = createSyncHarness({
      blocked: () =>
        configured ? null : new StorageSyncBlockedError('Storage is not configured', 'unconfigured')
    })
    await save('Doc', figArchive('v1'))
    await harness.drain()
    expect((await harness.store.getMeta('doc'))?.syncStatus).toBe('pending')
    expect(harness.bucket.requests).toEqual([])

    configured = true
    await harness.engine.resume()
    await harness.drain()
    expect((await harness.store.getMeta('doc'))?.syncStatus).toBe('synced')
  })
})
