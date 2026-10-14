import { extractFigThumbnailFromReader } from '@open-pencil/fig'

import type { StorageDocumentFormat, StorageProviderID } from '@/app/integrations/storage/types'
import { evictLocalFigCache } from '@/app/storage/cache-eviction'
import { computeBodyIdSafe } from '@/app/storage/identity/body'
import { computeStateIdentity } from '@/app/storage/identity/state'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { bodyIsConfirmed } from '@/app/storage/local-store/meta'
import type { LocalCanvasStore } from '@/app/storage/local-store/store'
import { enqueuePutCanvas, enqueuePutMetadata } from '@/app/storage/sync/runtime'
import { emitStorageWorkspaceEvent } from '@/app/storage/workspace/events'

export type StoragePersistenceDependencies = {
  store: LocalCanvasStore
  enqueueCanvas(canvasId: string, revision: number): Promise<void>
  enqueueMetadata?(canvasId: string, revision: number): Promise<void>
}

export type PersistStorageCanvasOptions = {
  providerId: StorageProviderID
  canvasId: string
  name: string
  figBytes: Uint8Array
}

/** Nothing in this build opens a slide deck, so nothing may save one over its bytes. */
export class DeckWriteRefusedError extends Error {
  constructor(canvasId: string) {
    super(`"${canvasId}" is a slide deck; this version of OpenPencil cannot save it`)
    this.name = 'DeckWriteRefusedError'
  }
}

async function embeddedThumbnail(figBytes: Uint8Array): Promise<Uint8Array | null> {
  return extractFigThumbnailFromReader({
    size: figBytes.byteLength,
    async read(start, endExclusive) {
      return figBytes.subarray(start, endExclusive)
    }
  })
}

/**
 * Write locally, then queue what the destination is missing. A save whose state the destination
 * already holds queues nothing; a save that changes only metadata (a rename) queues a
 * metadata-only commit. A design in conflict keeps that status, so autosave never undoes it.
 */
export async function persistStorageCanvasLocally(
  options: PersistStorageCanvasOptions,
  dependencies?: StoragePersistenceDependencies
): Promise<{ revision: number }> {
  const runtime = dependencies ?? {
    store: getLocalCanvasStore(),
    enqueueCanvas: enqueuePutCanvas,
    enqueueMetadata: enqueuePutMetadata
  }
  const existing = await runtime.store.getMeta(options.canvasId)
  if (existing?.sourceFormat === 'deck') throw new DeckWriteRefusedError(options.canvasId)
  const bodyId = await computeBodyIdSafe(options.figBytes, 'fig')
  const metadata = await runtime.store.writeCanvas({
    id: options.canvasId,
    providerId: options.providerId,
    name: options.name,
    figBytes: options.figBytes,
    thumbBytes: await embeddedThumbnail(options.figBytes),
    bodyId,
    syncStatus: existing?.syncStatus === 'conflict' ? 'conflict' : 'pending'
  })
  const { stateId } = await computeStateIdentity(bodyId, {
    documentId: options.canvasId,
    name: metadata.name,
    sourceFormat: metadata.sourceFormat,
    isTrashed: metadata.trashedAt !== null
  })

  const alreadyStored =
    metadata.syncStatus !== 'conflict' &&
    (stateId === metadata.baseStateId || stateId === metadata.lastPublishedStateId)
  if (alreadyStored) {
    await runtime.store.updateMeta(
      options.canvasId,
      { syncStatus: 'synced', syncedBodyId: bodyId, baseStateId: stateId, lastSyncError: null },
      { expectedRevision: metadata.revision }
    )
  } else if (runtime.enqueueMetadata && bodyIsConfirmed(metadata) && metadata.versionedConfirmed) {
    await runtime.enqueueMetadata(options.canvasId, metadata.revision)
  } else {
    await runtime.enqueueCanvas(options.canvasId, metadata.revision)
  }
  emitStorageWorkspaceEvent({
    providerId: options.providerId,
    documentId: options.canvasId,
    kind: 'changed'
  })
  return { revision: metadata.revision }
}

export type SeedStorageCanvasOptions = {
  providerId: StorageProviderID
  canvasId: string
  name: string
  updatedAt: string
  figBytes: Uint8Array
  thumbnailBytes?: Uint8Array | null
  sourceFormat?: StorageDocumentFormat
  trashedAt?: string | null
  /** The remote state the bytes were downloaded at; it becomes the base of local edits. */
  baseStateId?: string | null
  /** The body id the destination stores these bytes under, when it reported one. */
  remoteBodyId?: string | null
  /** The bytes came from a versioned commit (`bodies/<id>`), not the legacy layout. */
  versioned?: boolean
  syncDestination?: string | null
  markSynced?: boolean
}

/** Cache a design downloaded from storage: its bytes are, provably, stored there. */
export async function seedStorageCanvasFromRemote(
  options: SeedStorageCanvasOptions
): Promise<void> {
  const sourceFormat = options.sourceFormat ?? 'fig'
  const bodyId = options.remoteBodyId ?? (await computeBodyIdSafe(options.figBytes, sourceFormat))
  const markSynced = options.markSynced !== false
  await getLocalCanvasStore().writeCanvas({
    id: options.canvasId,
    providerId: options.providerId,
    name: options.name,
    updatedAt: options.updatedAt,
    figBytes: options.figBytes,
    thumbBytes: options.thumbnailBytes,
    sourceFormat,
    trashedAt: options.trashedAt,
    bodyId,
    syncedBodyId: markSynced ? bodyId : undefined,
    baseStateId: options.baseStateId ?? null,
    versionedConfirmed: markSynced ? options.versioned === true : undefined,
    syncDestination: options.syncDestination,
    syncStatus: markSynced ? 'synced' : 'pending'
  })
  if (!markSynced) return
  await getLocalCanvasStore().updateMeta(options.canvasId, {
    lastSyncedAt: options.updatedAt || new Date().toISOString(),
    syncStatus: 'synced',
    lastSyncError: null
  })
  await evictLocalFigCache(new Set([options.canvasId]))
}
