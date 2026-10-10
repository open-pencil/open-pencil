import { createStorageAdapter, storageLocationOf } from '@/app/integrations/storage'
import { createCanvasId } from '@/app/storage/id'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { kickSyncEngine } from '@/app/storage/sync/engine'
import { getOutbox } from '@/app/storage/sync/outbox'
import {
  persistStorageCanvasLocally,
  seedStorageCanvasFromRemote
} from '@/app/storage/sync/persist'
import { emitStorageWorkspaceEvent } from '@/app/storage/workspace/events'

/**
 * Ways out of a conflict, where this device holds edits made from a revision the provider has
 * since replaced. Until one runs, both versions are kept: the local bytes here and the newer
 * revision on the provider.
 */

async function conflictedCanvas(canvasId: string) {
  const store = getLocalCanvasStore()
  const meta = await store.getMeta(canvasId)
  if (meta?.syncStatus !== 'conflict') {
    throw new Error('This document has no conflict to resolve')
  }
  return { store, meta }
}

/** Drops a document's queued uploads, for edits that are kept elsewhere. */
export async function dropCanvasUploads(canvasId: string): Promise<void> {
  const outbox = getOutbox()
  const jobs = await outbox.list()
  await Promise.all(
    jobs
      .filter((job) => job.canvasId === canvasId && job.type !== 'deleteCanvas')
      .map((job) => outbox.remove(job.id))
  )
}

/** Discards this device's edits and takes the provider's newer revision. */
export async function takeStoredVersion(canvasId: string): Promise<void> {
  const { meta } = await conflictedCanvas(canvasId)
  const location = storageLocationOf(meta)
  const content = await createStorageAdapter(location).getDocument(canvasId)
  await dropCanvasUploads(canvasId)
  await seedStorageCanvasFromRemote({
    ...location,
    canvasId,
    name: meta.name,
    updatedAt: new Date().toISOString(),
    figBytes: content.bytes,
    remoteRevision: content.revision
  })
  emitStorageWorkspaceEvent({ ...location, documentId: canvasId, kind: 'changed' })
}

/**
 * Saves this device's edits as a new document beside the original, then takes the provider's
 * revision for the original. Returns the copy's ID.
 */
export async function keepBothVersions(canvasId: string, copyName: string): Promise<string> {
  const { store, meta } = await conflictedCanvas(canvasId)
  const local = await store.readFig(canvasId)
  if (!local?.byteLength) throw new Error('This device no longer has its version of the document')
  const copyId = createCanvasId()
  await persistStorageCanvasLocally({
    ...storageLocationOf(meta),
    canvasId: copyId,
    name: copyName,
    figBytes: local
  })
  await takeStoredVersion(canvasId)
  return copyId
}

/** Uploads this device's edits over the provider's newer revision. */
export async function replaceStoredVersion(canvasId: string): Promise<void> {
  const { store, meta } = await conflictedCanvas(canvasId)
  await store.updateMeta(canvasId, {
    syncStatus: 'pending',
    remoteRevision: meta.conflictRevision ?? meta.remoteRevision ?? null,
    conflictRevision: null,
    lastSyncError: null
  })
  const outbox = getOutbox()
  const jobs = (await outbox.list()).filter(
    (job) => job.canvasId === canvasId && job.type === 'putCanvas'
  )
  if (jobs.length === 0) {
    await outbox.enqueue({ canvasId, type: 'putCanvas', revision: meta.revision })
  } else {
    const now = Date.now()
    await Promise.all(jobs.map((job) => outbox.update({ ...job, nextAttemptAt: now })))
  }
  emitStorageWorkspaceEvent({ ...storageLocationOf(meta), documentId: canvasId, kind: 'changed' })
  void kickSyncEngine()
}
