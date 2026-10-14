import { createS3StorageAdapterWithConfig } from '@/app/integrations/storage/s3/adapter'
import type { StorageAdapter } from '@/app/integrations/storage/types'
import { clearVersionManifestCache } from '@/app/integrations/storage/versioned/manifest-cache'
import { createMemoryLocalCanvasStore } from '@/app/storage/local-store/memory'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import { createSyncEngine, type SyncEngine } from '@/app/storage/sync/engine'
import { createMemoryOutbox, type Outbox } from '@/app/storage/sync/outbox'
import type { StorageWorkspaceEvent } from '@/app/storage/workspace/events'

import { MEMORY_S3_CONFIG, installMemoryS3, type MemoryS3 } from '#tests/helpers/storage/memory-s3'

export const PROVIDER = 's3-compatible'
export const DESTINATION = 's3-compatible#bucket-1'

export type SyncHarness = {
  engine: SyncEngine
  store: LocalCanvasStore
  outbox: Outbox
  bucket: MemoryS3
  adapter: StorageAdapter
  events: StorageWorkspaceEvent[]
  /** The engine's clock, advanced by `drain` to the next due job. */
  clock: { now: number }
  destination: { current: string | null }
  /** Run queued work to completion, moving the clock past each job's spacing. */
  drain(limit?: number): Promise<void>
  dispose(): void
}

/**
 * The real sync engine against the real S3 adapter and an in-memory bucket, with an injected
 * clock: no timers, no listeners, no Web Locks.
 */
export function createSyncHarness(
  options: {
    blocked?: () => Error | null
    adapter?: (inner: StorageAdapter) => StorageAdapter
  } = {}
): SyncHarness {
  clearVersionManifestCache()
  const bucket = installMemoryS3()
  const inner = createS3StorageAdapterWithConfig(async () => MEMORY_S3_CONFIG)
  const adapter = options.adapter?.(inner) ?? inner
  const store = createMemoryLocalCanvasStore()
  const outbox = createMemoryOutbox()
  const events: StorageWorkspaceEvent[] = []
  const clock = { now: Date.parse('2026-08-04T12:00:00.000Z') }
  const destination: { current: string | null } = { current: DESTINATION }

  const engine = createSyncEngine({
    getStore: () => store,
    getOutbox: () => outbox,
    activeProviderId: () => PROVIDER,
    resolveAdapter: async () => {
      const blocked = options.blocked?.()
      if (blocked) throw blocked
      return adapter
    },
    destinationOf: () => destination.current,
    isOnline: () => true,
    subscribeConnectivity: () => () => undefined,
    schedule: () => () => undefined,
    now: () => clock.now,
    random: () => 0,
    runExclusive: (_key, run) => run(),
    emit: (event) => events.push(event)
  })

  async function drain(limit = 50): Promise<void> {
    for (let i = 0; i < limit; i++) {
      await engine.idle()
      const due = (await outbox.list())
        .map((job) => job.nextAttemptAt)
        .filter((at) => at !== Number.MAX_SAFE_INTEGER)
      if (due.length === 0) return
      clock.now = Math.max(clock.now, Math.min(...due))
      await engine.kick()
    }
  }

  return {
    engine,
    store,
    outbox,
    bucket,
    adapter,
    events,
    clock,
    destination,
    drain,
    dispose: () => {
      engine.dispose()
      bucket.restore()
    }
  }
}
