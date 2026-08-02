import type { StorageAdapter, StorageDocument, StorageProviderID } from '@/app/integrations/storage'
import { createActiveStorageAdapter } from '@/app/integrations/storage'
import { createCanvasId } from '@/app/storage/id'
import { getLocalCanvasStore, type LocalCanvasStore } from '@/app/storage/local-store'
import {
  enqueueDeleteCanvas,
  enqueuePutMetadata,
  persistStorageCanvasLocally
} from '@/app/storage/sync'
import { createStorageThumbnail, isUsableStorageThumbnail } from '@/app/storage/thumbnail'

type StorageDocumentContent = {
  bytes: Uint8Array
  thumbnailBytes: Uint8Array | null
}

export type StorageDocumentMutationDependencies = {
  store: LocalCanvasStore
  adapter: StorageAdapter
  persist: typeof persistStorageCanvasLocally
  enqueueMetadata: typeof enqueuePutMetadata
  enqueueDelete: typeof enqueueDeleteCanvas
  createId: typeof createCanvasId
}

function dependenciesFor(
  providerId: StorageProviderID,
  dependencies?: StorageDocumentMutationDependencies
): StorageDocumentMutationDependencies {
  return (
    dependencies ?? {
      store: getLocalCanvasStore(),
      adapter: createActiveStorageAdapter(providerId),
      persist: persistStorageCanvasLocally,
      enqueueMetadata: enqueuePutMetadata,
      enqueueDelete: enqueueDeleteCanvas,
      createId: createCanvasId
    }
  )
}

async function readContent(
  document: StorageDocument,
  runtime: StorageDocumentMutationDependencies,
  requireThumbnail: boolean
): Promise<StorageDocumentContent> {
  const metadata = await runtime.store.getMeta(document.id)
  const localBytes = metadata?.hasFig ? await runtime.store.readFig(document.id) : null
  const bytes = localBytes ?? (await runtime.adapter.getDocument(document.id))
  let thumbnailBytes = await runtime.store.readThumb(document.id)
  if (!isUsableStorageThumbnail(thumbnailBytes) && runtime.adapter.getThumbnail) {
    thumbnailBytes = await runtime.adapter.getThumbnail(document.id).catch(() => null)
  }
  if (requireThumbnail && !isUsableStorageThumbnail(thumbnailBytes)) {
    thumbnailBytes = await createStorageThumbnail(bytes, document.sourceFormat).catch(() => null)
  }
  return { bytes, thumbnailBytes }
}

async function rewriteStorageDocument(
  providerId: StorageProviderID,
  document: StorageDocument,
  patch: Pick<StorageDocument, 'name' | 'trashedAt'>,
  dependencies?: StorageDocumentMutationDependencies
): Promise<StorageDocument> {
  const runtime = dependenciesFor(providerId, dependencies)
  const updatedAt = new Date().toISOString()
  const existing = await runtime.store.getMeta(document.id)
  const metadata = existing
    ? await runtime.store.updateMeta(document.id, {
        name: patch.name,
        trashedAt: patch.trashedAt,
        updatedAt,
        revision: existing.revision + 1,
        syncStatus: 'pending',
        lastSyncError: null
      })
    : await runtime.store.upsertIndexMeta({
        id: document.id,
        providerId,
        name: patch.name,
        sourceFormat: document.sourceFormat,
        trashedAt: patch.trashedAt,
        updatedAt,
        revision: 1,
        syncStatus: 'pending',
        lastSyncedAt: document.updatedAt,
        lastSyncError: null
      })
  if (!metadata) throw new Error(`Stored document not found: ${document.id}`)
  await runtime.enqueueMetadata(document.id, metadata.revision)
  return {
    ...document,
    ...patch,
    updatedAt,
    metadataAuthoritative: true
  }
}

export function renameStorageDocument(
  providerId: StorageProviderID,
  document: StorageDocument,
  name: string,
  dependencies?: StorageDocumentMutationDependencies
): Promise<StorageDocument> {
  return rewriteStorageDocument(
    providerId,
    document,
    { name: name.trim() || 'Untitled', trashedAt: document.trashedAt },
    dependencies
  )
}

export function moveStorageDocumentToTrash(
  providerId: StorageProviderID,
  document: StorageDocument,
  dependencies?: StorageDocumentMutationDependencies
): Promise<StorageDocument> {
  return rewriteStorageDocument(
    providerId,
    document,
    { name: document.name, trashedAt: new Date().toISOString() },
    dependencies
  )
}

export function restoreStorageDocument(
  providerId: StorageProviderID,
  document: StorageDocument,
  dependencies?: StorageDocumentMutationDependencies
): Promise<StorageDocument> {
  return rewriteStorageDocument(
    providerId,
    document,
    { name: document.name, trashedAt: null },
    dependencies
  )
}

export async function duplicateStorageDocument(
  providerId: StorageProviderID,
  document: StorageDocument,
  name: string,
  dependencies?: StorageDocumentMutationDependencies
): Promise<{ document: StorageDocument; thumbnailBytes: Uint8Array | null }> {
  const runtime = dependenciesFor(providerId, dependencies)
  const { bytes, thumbnailBytes } = await readContent(document, runtime, true)
  const id = runtime.createId()
  const updatedAt = new Date().toISOString()
  await runtime.persist({
    providerId,
    canvasId: id,
    name,
    sourceFormat: document.sourceFormat,
    updatedAt,
    trashedAt: null,
    figBytes: bytes,
    thumbnailBytes
  })
  return {
    document: {
      id,
      name,
      sourceFormat: document.sourceFormat,
      trashedAt: null,
      updatedAt,
      metadataAuthoritative: true
    },
    thumbnailBytes
  }
}

export async function permanentlyDeleteStorageDocument(
  providerId: StorageProviderID,
  document: StorageDocument,
  dependencies?: StorageDocumentMutationDependencies
): Promise<void> {
  const runtime = dependenciesFor(providerId, dependencies)
  const metadata = await runtime.store.tombstone(document.id)
  if (!metadata) throw new Error(`Stored document not found: ${document.id}`)
  await runtime.enqueueDelete(document.id)
}
