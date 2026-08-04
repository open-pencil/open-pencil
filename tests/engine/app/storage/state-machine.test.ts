import { afterEach, describe, expect, test } from 'bun:test'

import type { StorageDocument } from '@/app/integrations/storage'
import { setBackupToCloud } from '@/app/storage/backup'
import {
  moveStorageDocumentToTrash,
  permanentlyDeleteStorageDocument,
  renameStorageDocument,
  restoreStorageDocument,
  type StorageDocumentMutationDependencies
} from '@/app/storage/documents'
import {
  createMemoryLocalCanvasStore,
  resetLocalCanvasStoreForTests
} from '@/app/storage/local-store'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import { promoteLocalDocuments } from '@/app/storage/promote'
import { retargetStorageDocument } from '@/app/storage/retarget'
import { migrateLegacyOutboxJobs } from '@/app/storage/sync/migrate-jobs'
import { createMemoryOutbox, resetOutboxForTests, type Outbox } from '@/app/storage/sync/outbox'
import { persistStorageCanvasLocally } from '@/app/storage/sync/persist'
import { repairOrphanedPendingRows } from '@/app/storage/sync/repair'
import type { OutboxJobType } from '@/app/storage/sync/types'
import type { StorageTargetID } from '@/app/storage/target'

import {
  createHarness,
  recordingAdapter,
  settle,
  type Harness,
  type RecordingAdapter
} from './sync/harness'

/**
 * The transition table from `offline-initial-workspace` design decision 7,
 * enforced against the code that actually produces the state. Two rules hold
 * across every row of it, and each describes an unrecoverable corruption:
 *
 * 1. A `pending` row ALWAYS has a durable job addressed to the row's CURRENT
 *    target. With no job — or one addressed elsewhere — nothing ever clears
 *    the state and eviction skips the row forever.
 * 2. A `local` row NEVER has one. `local` means "committed here, no upload
 *    intended", and a job behind it uploads what the user chose not to.
 *
 * Driven through the real functions: hand-writing rows would prove only that
 * the test can write rows.
 */

const PROVIDER = 's3-compatible'
const TARGET: StorageTargetID = 's3-compatible#aaaaaaaa'
const NEXT_TARGET: StorageTargetID = 's3-compatible#bbbbbbbb'
const BODY = new Uint8Array(512).fill(3)
const EDITED_BODY = new Uint8Array(512).fill(7)

type World = {
  readonly store: LocalCanvasStore
  readonly outbox: Outbox
  readonly adapter: RecordingAdapter
  readonly engine: Harness['engine']
  /** Reach the network and run the queue to completion. */
  drain(): Promise<void>
  /** Reachability alone, for the tests that stop mid-drain. */
  setOnline(value: boolean): void
  /** Fresh engine over the same durable state. */
  restart(): Promise<void>
  dispose(): void
}

const openWorlds: World[] = []

/**
 * An engine that is offline by default. Draining is its own transition, and
 * keeping the queue parked for the rest is what makes the durable state
 * observable: a job that already ran proves nothing about whether it existed.
 */
function createWorld(adapter: RecordingAdapter = recordingAdapter()): World {
  const store = createMemoryLocalCanvasStore()
  const outbox = createMemoryOutbox()
  let online = false
  let harness = newHarness()

  function newHarness(): Harness {
    return createHarness({
      getStore: () => store,
      getOutbox: () => outbox,
      adapter,
      isOnline: () => online
    })
  }

  // Point the module singletons here too, so any default dependency that slips
  // through reaches this world's store rather than a shared one.
  resetLocalCanvasStoreForTests(store)
  resetOutboxForTests(outbox)

  async function pump(): Promise<void> {
    online = true
    for (let pass = 0; pass < 12; pass++) {
      await harness.engine.kick()
      await harness.drainWakes()
      if ((await outbox.list()).length === 0) break
    }
    online = false
  }

  const startup = { getStore: () => store, getOutbox: () => outbox }
  const world: World = {
    store,
    outbox,
    adapter,
    get engine() {
      return harness.engine
    },
    drain: pump,
    setOnline(value: boolean) {
      online = value
    },
    async restart() {
      harness.dispose()
      harness = newHarness()
      // Exactly what `startStorageSync()` does, in its order: pin the legacy
      // jobs, reconcile the rows against the durable queue, then pump.
      await migrateLegacyOutboxJobs(startup)
      await repairOrphanedPendingRows(startup)
      await pump()
    },
    dispose() {
      harness.dispose()
      resetLocalCanvasStoreForTests()
      resetOutboxForTests()
    }
  }
  openWorlds.push(world)
  return world
}

/** The store plus the engine's real enqueue entry points, for every caller. */
function outboxDeps(world: World) {
  return {
    store: world.store,
    enqueueCanvas: (id: string, revision: number) => world.engine.enqueuePutCanvas(id, revision),
    enqueueMetadata: (id: string, revision: number) =>
      world.engine.enqueuePutMetadata(id, revision),
    enqueueThumbnail: (id: string, revision: number) => world.engine.enqueuePutThumb(id, revision)
  }
}

type SaveOptions = { canvasId?: string; figBytes?: Uint8Array; trashedAt?: string | null }

/** One editor save, through the path autosave and import both take. */
function save(world: World, targetId: StorageTargetID | null, options: SaveOptions = {}) {
  const { canvasId = 'doc', figBytes = BODY, trashedAt = null } = options
  return persistStorageCanvasLocally(
    { syncTargetId: targetId, canvasId, name: 'Doc', trashedAt, figBytes },
    outboxDeps(world)
  )
}

function retargetDeps(world: World) {
  return {
    store: world.store,
    outbox: world.outbox,
    enqueueCanvas: outboxDeps(world).enqueueCanvas
  }
}

function documentDeps(world: World): StorageDocumentMutationDependencies {
  let created = 0
  return {
    store: world.store,
    adapter: world.adapter,
    persist: (options) => persistStorageCanvasLocally(options, outboxDeps(world)),
    enqueueMetadata: (canvasId, revision) => world.engine.enqueuePutMetadata(canvasId, revision),
    enqueueDelete: (canvasId) => world.engine.enqueueDeleteCanvas(canvasId),
    createId: () => `copy-${++created}`
  }
}

/**
 * Every violation of the two global rules, as text: a failure has to name the
 * document and the state it is stuck in, because these states are silent.
 */
async function stateMachineViolations(world: World): Promise<string[]> {
  const metas = await world.store.listMetas(true)
  const jobs = await world.outbox.list()
  const violations: string[] = []

  for (const meta of metas) {
    const own = jobs.filter((job) => job.canvasId === meta.id)
    const queued = own.map((job) => `${job.type}→${String(job.targetId)}`).join(', ') || 'none'

    if (meta.syncStatus === 'pending') {
      if (meta.syncTargetId === null) {
        // No destination means no job can ever be resolved for this row:
        // `resolveConfiguredTarget` refuses a null target by design, so the
        // row waits on work that cannot run.
        violations.push(`${meta.id}: pending with no destination (queued: ${queued})`)
      } else if (!own.some((job) => job.targetId === meta.syncTargetId)) {
        violations.push(
          `${meta.id}: pending with no durable job for ${meta.syncTargetId} (queued: ${queued})`
        )
      }
    }

    if (meta.syncStatus === 'local' && own.length > 0) {
      violations.push(`${meta.id}: local with queued remote work (${queued})`)
    }
  }

  return violations
}

async function queuedTypes(world: World, canvasId: string): Promise<OutboxJobType[]> {
  const jobs = await world.outbox.list()
  return jobs.filter((job) => job.canvasId === canvasId).map((job) => job.type)
}

type Context = {
  label: string
  targetId: StorageTargetID | null
  backup: boolean
  /** Whether a mutation in this context may enqueue remote work at all. */
  uploads: boolean
}

const CONNECTED: Context = { label: 'connected', targetId: TARGET, backup: true, uploads: true }
const NO_TARGET: Context = { label: 'no target', targetId: null, backup: true, uploads: false }
const PAUSED: Context = { label: 'backup paused', targetId: TARGET, backup: false, uploads: false }
const CONTEXTS = [CONNECTED, NO_TARGET, PAUSED]

/** Commit as the editor does, and let a destination finish receiving it — a
 * rename acts on a document that is already there. */
async function seedCommitted(
  world: World,
  id: string,
  context: Context,
  trashedAt: string | null = null
): Promise<StorageDocument> {
  setBackupToCloud(context.backup)
  await save(world, context.targetId, { canvasId: id, trashedAt })
  if (context.uploads) await world.drain()
  await settle()
  const meta = await world.store.getMeta(id)
  if (!meta) throw new Error(`seed failed for ${id}`)
  const { name, sourceFormat, updatedAt } = meta
  return { id, name, sourceFormat, updatedAt, trashedAt, metadataAuthoritative: true }
}

// Tear down here, not at the end of each test: a failing assertion never
// reaches the last line, and a leaked world stays wired to the singletons.
afterEach(() => {
  for (const world of openWorlds.splice(0)) world.dispose()
  setBackupToCloud(true)
})

type Mutation = {
  transition: string
  seedTrashedAt?: string
  /** The single job this transition owes a live destination — and no more. */
  jobWhenUploading: OutboxJobType
  act(world: World, document: StorageDocument, context: Context): Promise<unknown>
}

const MUTATIONS: Mutation[] = [
  {
    transition: 'save / body edit',
    jobWhenUploading: 'putCanvas',
    act: (world, document, context) =>
      save(world, context.targetId, { canvasId: document.id, figBytes: EDITED_BODY })
  },
  {
    transition: 'rename',
    jobWhenUploading: 'putMetadata',
    act: (world, document) =>
      renameStorageDocument(PROVIDER, document, 'Renamed', documentDeps(world))
  },
  {
    transition: 'trash',
    jobWhenUploading: 'putMetadata',
    act: (world, document) => moveStorageDocumentToTrash(PROVIDER, document, documentDeps(world))
  },
  {
    transition: 'restore',
    seedTrashedAt: '2026-01-01T00:00:00.000Z',
    jobWhenUploading: 'putMetadata',
    act: (world, document) => restoreStorageDocument(PROVIDER, document, documentDeps(world))
  }
]

describe('save / rename / trash / restore', () => {
  for (const context of CONTEXTS) {
    for (const mutation of MUTATIONS) {
      test(`${mutation.transition} — ${context.label}`, async () => {
        const world = createWorld()
        const document = await seedCommitted(world, 'doc', context, mutation.seedTrashedAt ?? null)

        await mutation.act(world, document, context)
        await settle()

        expect(await stateMachineViolations(world)).toEqual([])
        // Decision 7: with no target or backup off the mutation commits locally
        // and enqueues nothing. Only a live destination makes the row `pending`,
        // and then for exactly the work that changed.
        expect((await world.store.getMeta('doc'))?.syncStatus).toBe(
          context.uploads ? 'pending' : 'local'
        )
        expect(await queuedTypes(world, 'doc')).toEqual(
          context.uploads ? [mutation.jobWhenUploading] : []
        )
      })
    }
  }

  test('a paused rename/trash/restore never reaches the remote', async () => {
    // Pause means PAUSE: not one metadata write, not one delete, until the
    // user switches replication back on.
    const world = createWorld()
    const document = await seedCommitted(world, 'doc', PAUSED)
    const dependencies = documentDeps(world)

    await renameStorageDocument(PROVIDER, document, 'Renamed', dependencies)
    await moveStorageDocumentToTrash(PROVIDER, document, dependencies)
    await restoreStorageDocument(PROVIDER, document, dependencies)
    await world.drain()

    expect(world.adapter.calls).toEqual([])
  })
})

describe('permanent delete', () => {
  test('with a live destination, enqueues a target-pinned delete', async () => {
    const world = createWorld()
    const document = await seedCommitted(world, 'doc', CONNECTED)

    await permanentlyDeleteStorageDocument(PROVIDER, document, documentDeps(world))
    await settle()

    expect(await stateMachineViolations(world)).toEqual([])
    const meta = await world.store.getMeta('doc')
    expect(meta?.tombstoned).toBe(true)
    expect(meta?.syncStatus).toBe('pending')
    const [job] = await world.outbox.list()
    expect(job?.type).toBe('deleteCanvas')
    expect(job?.targetId).toBe(TARGET)

    // Acknowledged: bytes reclaimed, tombstone kept until a listing confirms.
    await world.drain()
    expect(await stateMachineViolations(world)).toEqual([])
    expect(await world.outbox.list()).toEqual([])
    expect((await world.store.getMeta('doc'))?.hasFig).toBe(false)
  })

  test('with no known replica, removes the row immediately', async () => {
    // Nothing was ever uploaded, so there is no remote object to delete and a
    // tombstone is a row waiting forever on a job that cannot run.
    const world = createWorld()
    const document = await seedCommitted(world, 'doc', NO_TARGET)

    await permanentlyDeleteStorageDocument(PROVIDER, document, documentDeps(world))
    await settle()

    expect(await stateMachineViolations(world)).toEqual([])
    expect(await world.store.getMeta('doc')).toBeNull()
    expect(await world.outbox.list()).toEqual([])
  })

  test('with a known replica while paused, keeps a local tombstone and queues nothing', async () => {
    // Deleting the remote object now would be a write during a pause; leaving
    // the row live would let the next listing revive a deleted document.
    const world = createWorld()
    const document = await seedCommitted(world, 'doc', CONNECTED)
    setBackupToCloud(false)

    await permanentlyDeleteStorageDocument(PROVIDER, document, documentDeps(world))
    await settle()

    expect(await stateMachineViolations(world)).toEqual([])
    const meta = await world.store.getMeta('doc')
    expect(meta?.tombstoned).toBe(true)
    expect(meta?.syncStatus).toBe('local')
    expect(await queuedTypes(world, 'doc')).toEqual([])

    await world.drain()
    expect(world.adapter.count('delete')).toBe(0)
  })
})

describe('connect / enable backup', () => {
  test('promotion assigns the target, enqueues, and only then marks pending', async () => {
    const world = createWorld()
    await seedCommitted(world, 'offline-1', NO_TARGET)
    await seedCommitted(world, 'offline-2', NO_TARGET)
    setBackupToCloud(true)

    await promoteLocalDocuments(TARGET, outboxDeps(world))
    await settle()

    expect(await stateMachineViolations(world)).toEqual([])
    for (const id of ['offline-1', 'offline-2']) {
      const meta = await world.store.getMeta(id)
      expect(meta?.syncTargetId).toBe(TARGET)
      expect(meta?.syncStatus).toBe('pending')
      expect(await queuedTypes(world, id)).toEqual(['putCanvas'])
    }

    await world.drain()
    expect(await stateMachineViolations(world)).toEqual([])
    expect((await world.store.getMeta('offline-1'))?.syncStatus).toBe('synced')
  })
})

describe('pause / resume', () => {
  test('pausing cancels queued work and returns live rows to local', async () => {
    const world = createWorld()
    setBackupToCloud(true)
    await save(world, TARGET)
    await settle()
    expect(await queuedTypes(world, 'doc')).toEqual(['putCanvas'])

    setBackupToCloud(false)
    await settle()

    expect(await stateMachineViolations(world)).toEqual([])
    // The harm first: a job left queued uploads the moment anything kicks the
    // engine, and a pause must touch nothing remote.
    await world.drain()
    expect(world.adapter.calls).toEqual([])
    // Decision 7: queued-but-not-in-flight outbound work is cancelled and the
    // row goes back to `local`.
    expect(await queuedTypes(world, 'doc')).toEqual([])
    expect((await world.store.getMeta('doc'))?.syncStatus).toBe('local')
  })

  test('resuming sends the next save to the destination it kept', async () => {
    const world = createWorld()
    await seedCommitted(world, 'doc', PAUSED)
    expect((await world.store.getMeta('doc'))?.syncTargetId).toBe(TARGET)

    setBackupToCloud(true)
    await save(world, TARGET, { figBytes: EDITED_BODY })
    await settle()

    expect(await stateMachineViolations(world)).toEqual([])
    expect((await world.store.getMeta('doc'))?.syncStatus).toBe('pending')
    expect(await queuedTypes(world, 'doc')).toEqual(['putCanvas'])

    await world.drain()
    expect(await stateMachineViolations(world)).toEqual([])
    expect(world.adapter.count('put')).toBe(1)
  })
})

describe('disconnect / retarget', () => {
  test('disconnect clears the target, keeps the bytes, and deletes nothing remotely', async () => {
    const world = createWorld()
    await seedCommitted(world, 'doc', CONNECTED)

    await retargetStorageDocument('doc', null, retargetDeps(world))
    await settle()

    expect(await stateMachineViolations(world)).toEqual([])
    const meta = await world.store.getMeta('doc')
    // Decision 7: a locally backed row keeps its bytes and metadata and becomes
    // `local`. `synced` with no destination claims a confirmation from nowhere.
    expect(meta?.syncStatus).toBe('local')
    expect(meta?.syncTargetId).toBeNull()
    expect(meta?.syncedBodyId).toBeNull()
    expect(meta?.hasFig).toBe(true)
    expect(await queuedTypes(world, 'doc')).toEqual([])
    expect(world.adapter.count('delete')).toBe(0)
  })

  test('retarget cancels old-target work, clears the confirmation, and queues the new upload', async () => {
    const world = createWorld()
    setBackupToCloud(true)
    await save(world, TARGET)
    await settle()
    const [queuedForOldTarget] = await world.outbox.list()
    expect(queuedForOldTarget?.targetId).toBe(TARGET)

    await retargetStorageDocument('doc', NEXT_TARGET, retargetDeps(world))
    await settle()

    expect(await stateMachineViolations(world)).toEqual([])
    const meta = await world.store.getMeta('doc')
    expect(meta?.syncTargetId).toBe(NEXT_TARGET)
    expect(meta?.syncStatus).toBe('pending')
    expect(meta?.syncedBodyId).toBeNull()
    const jobs = await world.outbox.list()
    expect(jobs.map((job) => job.targetId)).toEqual([NEXT_TARGET])
    expect(jobs.every((job) => job.id !== queuedForOldTarget?.id)).toBe(true)
    // Changing destination is not a request to remove anything from the old one.
    expect(world.adapter.count('delete')).toBe(0)
  })
})

/** A promise plus the handle that settles it, without a placeholder no-op. */
function createGate(): { reached: Promise<void>; open(): void } {
  const waiting: (() => void)[] = []
  const reached = new Promise<void>((resolve) => {
    waiting.push(resolve)
  })
  return { reached, open: () => waiting.forEach((resolve) => resolve()) }
}

/** A `putDocument` that blocks until the test lets it finish. */
function gatedAdapter(): { adapter: RecordingAdapter; started: Promise<void>; release(): void } {
  const inner = recordingAdapter()
  const gate = createGate()
  const start = createGate()

  const adapter: RecordingAdapter = {
    ...inner,
    calls: inner.calls,
    bodies: inner.bodies,
    count: inner.count,
    putDocument: async (id, bytes, onProgress) => {
      start.open()
      await gate.reached
      return inner.putDocument(id, bytes, onProgress)
    }
  }
  return { adapter, started: start.reached, release: gate.open }
}

describe('in-flight completion', () => {
  test('an upload that lands after a retarget confirms nothing for the new target', async () => {
    // The bytes went to the OLD bucket. Confirming them for the new one would
    // let eviction delete the only copy that bucket has never received.
    const gated = gatedAdapter()
    const world = createWorld(gated.adapter)
    setBackupToCloud(true)
    await save(world, TARGET)
    await settle()

    // One pump, stopped at the completion: draining past it uploads to the NEW
    // target and legitimately confirms it, hiding the case under test.
    world.setOnline(true)
    const pumping = world.engine.kick()
    await gated.started

    await retargetStorageDocument('doc', NEXT_TARGET, retargetDeps(world))
    gated.release()
    await pumping
    await settle()
    world.setOnline(false)

    expect(await stateMachineViolations(world)).toEqual([])
    const meta = await world.store.getMeta('doc')
    expect(meta?.syncTargetId).toBe(NEXT_TARGET)
    expect(meta?.syncedBodyId).toBeNull()
    expect(meta?.syncStatus).toBe('pending')
    // The old bucket got the bytes once; the new one is still owed an upload.
    expect(world.adapter.count('put')).toBe(1)
    const jobs = await world.outbox.list()
    expect(jobs.map((job) => job.targetId)).toEqual([NEXT_TARGET])
  })
})

describe('restart', () => {
  test('queued work survives with its destination intact', async () => {
    const world = createWorld()
    setBackupToCloud(true)
    await save(world, TARGET)
    await settle()

    // The tab closes before the queue drained; the next session picks it up.
    await world.restart()

    expect(await stateMachineViolations(world)).toEqual([])
    expect((await world.store.getMeta('doc'))?.syncStatus).toBe('synced')
    expect(await world.outbox.list()).toEqual([])
    expect(world.adapter.count('put')).toBe(1)
  })

  test('a row left pending by a failed enqueue is repaired on startup', async () => {
    // The one way `pending` and the outbox genuinely disagree: the status
    // write commits and the enqueue then fails (outbox unavailable, quota, a
    // blocked upgrade in another tab). Startup must derive status from jobs.
    const world = createWorld()
    const document = await seedCommitted(world, 'doc', CONNECTED)

    await expect(
      renameStorageDocument(PROVIDER, document, 'Renamed', {
        ...documentDeps(world),
        enqueueMetadata: async () => {
          throw new Error('outbox unavailable')
        }
      })
    ).rejects.toThrow('outbox unavailable')
    expect((await world.store.getMeta('doc'))?.syncStatus).toBe('pending')
    expect(await world.outbox.list()).toEqual([])

    await world.restart()

    expect(await stateMachineViolations(world)).toEqual([])
  })
})
