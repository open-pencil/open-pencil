import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { resolveStorageConflict, type ConflictResolution } from '@/app/storage/conflict'
import { persistStorageCanvasLocally } from '@/app/storage/sync/persist'

import { figArchive, fakePNG, writtenFor } from '#tests/helpers/storage/documents'
import {
  DESTINATION,
  PROVIDER,
  createSyncHarness,
  type SyncHarness
} from '#tests/helpers/storage/sync-harness'

let harness: SyncHarness
let rebinds: [string, string, string][]

beforeEach(() => {
  harness = createSyncHarness()
  rebinds = []
})

afterEach(() => {
  harness.dispose()
})

function save(name: string, bytes: Uint8Array) {
  return persistStorageCanvasLocally(
    { providerId: PROVIDER, canvasId: 'doc', name, figBytes: bytes },
    {
      store: harness.store,
      enqueueCanvas: (id, revision) => harness.engine.enqueue(id, 'putCanvas', revision),
      enqueueMetadata: (id, revision) => harness.engine.enqueue(id, 'putMetadata', revision)
    }
  )
}

function resolve(resolution: ConflictResolution = 'keep-both') {
  return resolveStorageConflict('doc', resolution, {
    store: harness.store,
    outbox: harness.outbox,
    adapter: harness.adapter,
    destination: DESTINATION,
    enqueueCanvas: (id, revision) => harness.engine.enqueue(id, 'putCanvas', revision),
    enqueueMetadata: (id, revision) => harness.engine.enqueue(id, 'putMetadata', revision),
    copyName: (name) => `${name} (conflicted copy)`,
    rebindOpenDesign: (fromId, toId, name) => rebinds.push([fromId, toId, name]),
    createId: () => 'copy'
  })
}

/** This device and another both change the design after its first sync. */
async function conflictOn(theirs: Uint8Array, mine: Uint8Array, myName = 'Doc') {
  const base = figArchive('base', fakePNG())
  await save('Doc', base)
  await harness.drain()
  const written = await writtenFor('Theirs', theirs)
  await harness.adapter.putDocumentVersion('doc', theirs, async () => written)
  await save(myName, mine)
  await harness.drain()
  expect((await harness.store.getMeta('doc'))?.syncStatus).toBe('conflict')
  return written
}

describe('conflict resolution', () => {
  test('autosave keeps a design in conflict, with its work parked', async () => {
    await conflictOn(figArchive('theirs'), figArchive('mine'))

    await save('Doc', figArchive('mine, later'))

    expect((await harness.store.getMeta('doc'))?.syncStatus).toBe('conflict')
    expect((await harness.outbox.list()).map((job) => job.nextAttemptAt)).toEqual([
      Number.MAX_SAFE_INTEGER
    ])
  })

  test('diverged bodies keep this device’s version as a copy; the original follows the remote', async () => {
    const mine = figArchive('mine', fakePNG())
    const theirs = await conflictOn(figArchive('theirs'), mine)

    const { copyId } = await resolve()
    await harness.drain()

    expect(copyId).toBe('copy')
    expect(rebinds).toEqual([['doc', 'copy', 'Doc (conflicted copy)']])
    expect(await harness.store.readFig('copy')).toEqual(mine)
    expect(await harness.store.readThumb('copy')).not.toBeNull()
    expect(await harness.store.getMeta('copy')).toMatchObject({ syncStatus: 'synced' })
    expect(await harness.store.getMeta('doc')).toMatchObject({
      name: 'Theirs',
      hasFig: false,
      syncStatus: 'synced',
      baseStateId: theirs.stateId
    })
    expect((await harness.adapter.getDocumentMetadata?.('doc'))?.name).toBe('Theirs')
  })

  test('a metadata-only divergence makes no copy and commits the newer name on top', async () => {
    const shared = figArchive('base', fakePNG())
    await conflictOn(shared, shared, 'My name')

    const { copyId } = await resolve()
    await harness.drain()

    expect(copyId).toBeNull()
    expect(rebinds).toEqual([])
    expect((await harness.adapter.getDocumentMetadata?.('doc'))?.name).toBe('My name')
    expect((await harness.store.getMeta('doc'))?.syncStatus).toBe('synced')
  })

  test('using the other device’s version drops this one without a copy', async () => {
    await conflictOn(figArchive('theirs'), figArchive('mine'))

    expect((await resolve('use-remote')).copyId).toBeNull()

    expect(await harness.store.getMeta('doc')).toMatchObject({ name: 'Theirs', hasFig: false })
    expect(await harness.outbox.list()).toEqual([])
  })
})
