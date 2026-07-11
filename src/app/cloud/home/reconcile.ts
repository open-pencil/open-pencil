import { getLocalCanvasStore } from '@/app/cloud/local-store'
import type { LocalCanvasMeta } from '@/app/cloud/local-store'
import { enqueueDeleteCanvas, enqueuePutCanvas } from '@/app/cloud/sync'
import type { CloudCanvas, CloudProviderId } from '@/app/cloud/types'

/** Seed/refresh local index rows from the remote listing. */
export async function reconcileRemoteEntries(
  adapterId: CloudProviderId,
  remote: CloudCanvas[],
  localById: Map<string, LocalCanvasMeta>,
  queuedIds: Set<string>
): Promise<void> {
  const local = getLocalCanvasStore()
  for (const r of remote) {
    const existing = localById.get(r.id)
    if (existing?.tombstoned) continue
    if (!existing) {
      await local.upsertIndexMeta({
        id: r.id,
        providerId: adapterId,
        name: r.name,
        updatedAt: r.updatedAt,
        syncStatus: 'synced',
        lastSyncedAt: r.updatedAt,
        lastSyncError: null,
        hasFig: false,
        hasThumb: false,
        revision: 1
      })
    } else if (
      existing.syncStatus === 'synced' &&
      r.updatedAt > existing.updatedAt &&
      // fallback (server LastModified) timestamps flap — never force
      // a re-download from them
      r.metaAuthoritative !== false &&
      !existing.tombstoned
    ) {
      await local.updateMeta(r.id, {
        name: r.name,
        updatedAt: r.updatedAt,
        hasFig: false // force re-download on next open
      })
    } else if (
      existing.syncStatus === 'synced' &&
      r.name !== existing.name &&
      // never rename from fallback listings (missing meta.json → name = raw id)
      r.metaAuthoritative !== false
    ) {
      await local.updateMeta(r.id, { name: r.name })
    } else if (existing.syncStatus === 'pending' && !queuedIds.has(r.id)) {
      // Orphaned 'pending' (no queued work, remote copy exists). If we hold
      // local content it may be a stranded unsynced edit — re-enqueue the
      // upload (idempotent when content already matches). Only index-only
      // rows (nothing local to upload) are safe to stamp synced directly.
      if (existing.hasFig) {
        await enqueuePutCanvas(r.id, existing.revision)
      } else {
        await local.updateMeta(r.id, { syncStatus: 'synced', lastSyncError: null })
      }
    }
  }
}

/** Purge confirmed-deleted tombstones, retry stranded deletes, drop vanished rows. */
export async function reconcileLocalMetas(
  localMetas: LocalCanvasMeta[],
  remoteIds: Set<string>,
  queuedIds: Set<string>
): Promise<void> {
  const local = getLocalCanvasStore()
  for (const m of localMetas) {
    if (m.tombstoned) {
      if (!remoteIds.has(m.id)) {
        // Remote confirmed gone — safe to purge the tombstone now.
        await local.remove(m.id)
      } else if (!queuedIds.has(m.id) && m.syncStatus !== 'error') {
        // Deleted locally but remote objects survive and no job is queued
        // (e.g. dropped mid-flight) — retry the remote delete. Rows marked
        // 'error' failed permanently (auth): retrying every reconcile would
        // loop forever, so leave them for a credentials fix + manual retry.
        await enqueueDeleteCanvas(m.id)
      }
      continue
    }
    // Drop fully synced local-only that vanished remotely (not pending/error)
    if (!remoteIds.has(m.id) && m.syncStatus === 'synced' && !m.hasFig) {
      await local.remove(m.id)
    }
  }
}
