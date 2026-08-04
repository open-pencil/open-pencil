import type { StorageAdapter } from '@/app/integrations/storage'

import type { LocalCanvasStore } from '../local-store'
import type { StorageTargetID } from '../target'
import type { Outbox } from './outbox'

/**
 * Migration sweep for the versioned remote layout.
 *
 * A row's `syncedBodyId` earned under the fixed-key layout proves bytes
 * reached `canvases/<id>.fig` — an address the versioned layout does not
 * serve. Every such confirmation is re-proved with a HEAD against
 * `bodies/{bodyId}.fig` before it is trusted: present means the proof stands
 * (content addressing makes "the same bytes" sound), absent means unconfirmed
 * and conservatively re-uploaded. No row's confirmation may silently carry
 * over across the layout boundary.
 */
export async function reconfirmVersionedBodies(
  store: LocalCanvasStore,
  outbox: Outbox,
  resolveTarget: (targetId: StorageTargetID | null) => Promise<StorageAdapter>
): Promise<void> {
  const rows = await store.listMetas()
  const candidates = rows.flatMap((meta) =>
    meta.syncedBodyId !== null &&
    meta.bodyId !== null &&
    meta.syncTargetId !== null &&
    !meta.tombstoned &&
    !(meta.versionedConfirmed ?? false)
      ? [{ id: meta.id, bodyId: meta.syncedBodyId, targetId: meta.syncTargetId }]
      : []
  )
  for (let offset = 0; offset < candidates.length; offset += 12) {
    const batch = candidates.slice(offset, offset + 12)
    await Promise.all(
      batch.map(async (candidate) => {
        const adapter = await resolveTarget(candidate.targetId)
        // Adapters without a versioned layout never changed address space:
        // their fixed-key proofs stay valid and there is nothing to re-prove.
        if (!adapter.hasRemoteBody) return
        const present = await adapter.hasRemoteBody(candidate.bodyId).catch(() => null)
        // A failed probe keeps the proof and retries on the next engine start;
        // destroying a confirmation on a network blip is exactly the eviction
        // hazard this field exists to prevent.
        if (present === null) return
        const latest = await store.getMeta(candidate.id)
        if (!latest || latest.tombstoned || latest.syncedBodyId !== candidate.bodyId) return
        if (present) {
          await store.updateMeta(candidate.id, { versionedConfirmed: true })
          return
        }
        // The proof describes an object the versioned layout does not have:
        // unconfirm so the body re-uploads and the row is not evictable on a
        // stale claim.
        await store.updateMeta(candidate.id, { syncedBodyId: null, syncStatus: 'pending' })
        await outbox.enqueue({
          canvasId: candidate.id,
          type: 'putCanvas',
          revision: latest.revision,
          targetId: latest.syncTargetId
        })
      })
    )
  }
}
