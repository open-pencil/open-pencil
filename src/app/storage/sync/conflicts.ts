import type { StorageDocument } from '@/app/integrations/storage'
import { createActiveStorageAdapter } from '@/app/integrations/storage'
import { createCanvasId } from '@/app/storage/id'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { kickSyncEngine } from '@/app/storage/sync/engine'
import { getOutbox } from '@/app/storage/sync/outbox'

async function removeCanvasJobs(canvasId: string): Promise<void> {
  const outbox = getOutbox()
  const jobs = await outbox.list()
  await Promise.all(
    jobs.filter((job) => job.canvasId === canvasId).map((job) => outbox.remove(job.id))
  )
}

export async function useRemoteConflictVersion(
  providerId: string,
  document: StorageDocument
): Promise<void> {
  if (!document.remoteRevisionId) throw new Error('Remote document has no committed revision')
  const adapter = createActiveStorageAdapter(providerId)
  const bytes = await adapter.getDocument(document.id)
  const store = getLocalCanvasStore()
  const existing = await store.getMeta(document.id)
  await store.writeCanvas({
    id: document.id,
    providerId,
    name: document.name,
    updatedAt: document.updatedAt,
    figBytes: bytes,
    revision: (existing?.revision ?? 0) + 1,
    syncStatus: 'synced'
  })
  await store.updateMeta(document.id, {
    lastSyncedAt: document.updatedAt,
    lastSyncError: null,
    remoteRevisionId: document.remoteRevisionId
  })
  await removeCanvasJobs(document.id)
}

export async function keepLocalConflictAsCopy(
  providerId: string,
  document: StorageDocument
): Promise<string> {
  const store = getLocalCanvasStore()
  const existing = await store.getMeta(document.id)
  const localBytes = await store.readFig(document.id)
  if (!existing || !localBytes) throw new Error('Local conflict copy is unavailable')
  const remoteBytes = await createActiveStorageAdapter(providerId).getDocument(document.id)
  const copyId = createCanvasId()
  const copy = await store.writeCanvas({
    id: copyId,
    providerId,
    name: `${existing.name} (local copy)`,
    updatedAt: new Date().toISOString(),
    figBytes: localBytes,
    syncStatus: 'pending'
  })
  await getOutbox().enqueue({ canvasId: copyId, type: 'putCanvas', revision: copy.revision })
  await store.writeCanvas({
    id: document.id,
    providerId,
    name: document.name,
    updatedAt: document.updatedAt,
    figBytes: remoteBytes,
    revision: existing.revision + 1,
    syncStatus: 'synced'
  })
  await store.updateMeta(document.id, {
    lastSyncedAt: document.updatedAt,
    lastSyncError: null,
    remoteRevisionId: document.remoteRevisionId
  })
  await removeCanvasJobs(document.id)
  void kickSyncEngine()
  return copyId
}

export async function replaceRemoteConflictVersion(document: StorageDocument): Promise<void> {
  if (!document.remoteRevisionId) throw new Error('Remote document has no committed revision')
  const store = getLocalCanvasStore()
  const existing = await store.getMeta(document.id)
  if (!existing) throw new Error('Local conflict copy is unavailable')
  await store.updateMeta(document.id, {
    syncStatus: 'pending',
    lastSyncError: null,
    remoteRevisionId: document.remoteRevisionId
  })
  await removeCanvasJobs(document.id)
  await getOutbox().enqueue({
    canvasId: document.id,
    type: 'putCanvas',
    revision: existing.revision
  })
  void kickSyncEngine()
}
