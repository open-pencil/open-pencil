import { getLocalCanvasStore } from '@/app/storage/local-store'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import { recordSyncFailure, UNKNOWN_PROVIDER, type SyncFailure } from '@/app/storage/sync/failure'
import { getOutbox, type Outbox } from '@/app/storage/sync/outbox'
import type { OutboxJob } from '@/app/storage/sync/types'

/** Provider label for a job whose destination cannot be named at all. */

export type LegacyJobMigrationDependencies = {
  getStore: () => LocalCanvasStore
  getOutbox: () => Outbox
  recordFailure: (failure: SyncFailure) => void
  now: () => string
}

export type LegacyJobMigrationResult = {
  /** Jobs given the target their canvas row names. */
  pinned: number
  /** Jobs whose destination could not be determined, parked for the user. */
  parked: number
}

const defaultDependencies: LegacyJobMigrationDependencies = {
  getStore: getLocalCanvasStore,
  getOutbox,
  recordFailure: recordSyncFailure,
  now: () => new Date().toISOString()
}

/**
 * Give every queued job a destination, once, at startup.
 *
 * Jobs enqueued before targets existed carry `targetId: null`. The engine used
 * to fall back to the row's current target at drain time, which is defensible
 * but implicit — and implicit is exactly how a document's bytes end up in
 * whatever bucket happens to be selected. Resolve it explicitly instead: pin
 * the job to the destination its row names, or, when no unambiguous one can be
 * built, PARK it with a visible failure.
 *
 * Parking is the conservative half and the reason this exists. A legacy job for
 * a local-only row, or for a row whose provider names no destination, has no
 * honest place to go. Sending it to the active destination would silently
 * publish a private document into someone's shared bucket; refusing to send it
 * costs the user one visible decision.
 *
 * Idempotent by construction: a pinned job no longer matches `targetId === null`
 * and a parked one is already at `MAX_SAFE_INTEGER`, so a second pass writes
 * nothing and records nothing.
 */
export async function migrateLegacyOutboxJobs(
  dependencies: Partial<LegacyJobMigrationDependencies> = {}
): Promise<LegacyJobMigrationResult> {
  const deps = { ...defaultDependencies, ...dependencies }
  const outbox = deps.getOutbox()
  const store = deps.getStore()
  const jobs = await outbox.list()

  let pinned = 0
  const parked: OutboxJob[] = []

  for (const job of jobs) {
    if (job.targetId !== null) continue

    const meta = await store.getMeta(job.canvasId)
    const targetId = meta?.syncTargetId ?? null
    if (targetId !== null) {
      // Pinning does not un-park: a job parked by a permanent failure keeps its
      // `nextAttemptAt`, and only an explicit resume revives it.
      await outbox.update({ ...job, targetId })
      pinned += 1
      continue
    }

    if (job.nextAttemptAt === Number.MAX_SAFE_INTEGER) continue
    await outbox.update({ ...job, nextAttemptAt: Number.MAX_SAFE_INTEGER })
    parked.push(job)
  }

  if (parked.length > 0) await reportParkedJobs(parked, deps)
  return { pinned, parked: parked.length }
}

/**
 * One failure for the whole parked set rather than one per job.
 *
 * `recordSyncFailure` keeps only the latest snapshot, so per-job reporting
 * would leave the user looking at an arbitrary one of N identical failures with
 * no indication that the rest exist.
 */
async function reportParkedJobs(
  parked: OutboxJob[],
  deps: LegacyJobMigrationDependencies
): Promise<void> {
  const store = deps.getStore()
  const documentIds = [...new Set(parked.map((job) => job.canvasId))]
  const first = await store.getMeta(documentIds[0] ?? '')
  const message =
    `${parked.length} queued change${parked.length === 1 ? '' : 's'} ` +
    'could not be matched to a storage destination and will not be sent. ' +
    'Open the document and save it again to choose where it belongs.'

  for (const id of documentIds) {
    const meta = await store.getMeta(id)
    if (!meta) continue
    await store.updateMeta(id, { syncStatus: 'error', lastSyncError: message })
  }

  deps.recordFailure({
    operation: parked[0]?.type ?? 'putCanvas',
    // These rows named no target, so there is no provider to attribute the
    // failure to. Naming the active one would be the same guess parking exists
    // to refuse, and it would read as "your current bucket rejected this".
    providerId: UNKNOWN_PROVIDER,
    providerContext: {},
    documentIds,
    documentName: first?.name ?? null,
    occurredAt: deps.now(),
    attempts: parked[0]?.attempts ?? 0,
    category: 'unknown',
    rawError: message,
    status: null
  })
}
