import type { StorageDocument, StorageLocation } from '@/app/integrations/storage'
import {
  activeStorageProviderID,
  createStorageAdapter,
  isStorageConfigured,
  sameStorageLocation,
  storageLocationOf
} from '@/app/integrations/storage'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { reconcileStorageDocuments } from '@/app/storage/reconcile'
import { onStorageWorkspaceEvent } from '@/app/storage/workspace/events'

export type StorageWorkspaceSnapshot = {
  documents: StorageDocument[]
  configured: boolean
}

/** The configured storage bucket, the location home lists when no other is chosen. */
export function activeStorageLocation(): StorageLocation {
  return { providerId: activeStorageProviderID.value }
}

/**
 * Lists one storage location for home: the provider's documents merged with this device's
 * copies, so unsent work shows while the provider is unreachable or not configured.
 */
export function createStorageWorkspaceSource(
  onSnapshot: (snapshot: StorageWorkspaceSnapshot) => void,
  location: () => StorageLocation = activeStorageLocation
) {
  const isCurrent = (requested: StorageLocation) => sameStorageLocation(requested, location())
  const isHere = (metadata: StorageLocation, requested: StorageLocation) =>
    sameStorageLocation(storageLocationOf(metadata), requested)

  return {
    subscribe(listener: () => void): () => void {
      return onStorageWorkspaceEvent((event) => {
        if (isCurrent(event)) listener()
      })
    },

    async refresh(): Promise<StorageDocument[] | null> {
      const requested = location()
      const configured = await isStorageConfigured(requested.providerId)
      const localStore = getLocalCanvasStore()
      const local = (await localStore.listMetas(true)).filter((metadata) =>
        isHere(metadata, requested)
      )
      const localDocuments = local
        .filter((metadata) => !metadata.tombstoned)
        .map((metadata) => ({
          id: metadata.id,
          name: metadata.name,
          updatedAt: metadata.updatedAt,
          metadataAuthoritative: true,
          revision: metadata.remoteRevision ?? null
        }))
      if (!configured) {
        if (!isCurrent(requested)) return null
        onSnapshot({ documents: localDocuments, configured })
        return localDocuments
      }

      let remote: StorageDocument[]
      try {
        remote = await createStorageAdapter(requested).listDocuments()
      } catch (error) {
        // Out of reach or signed out: this device's copies still show, beside the error.
        if (isCurrent(requested)) onSnapshot({ documents: localDocuments, configured })
        throw error
      }
      const reconciliation = reconcileStorageDocuments(local, remote)
      for (const id of reconciliation.localIdsToPurge) await localStore.remove(id)
      for (const document of reconciliation.remoteDocumentsToSeed) {
        await localStore.upsertIndexMeta({
          id: document.id,
          ...storageLocationOf(requested),
          name: document.name,
          updatedAt: document.updatedAt,
          syncStatus: 'synced',
          lastSyncedAt: document.updatedAt,
          lastSyncError: null,
          remoteRevision: document.revision ?? null
        })
      }
      if (!isCurrent(requested)) return null
      onSnapshot({ documents: reconciliation.documents, configured })
      return reconciliation.documents
    },

    async loadPreview(id: string): Promise<Uint8Array | null> {
      const requested = location()
      const localStore = getLocalCanvasStore()
      const local = await localStore.readThumb(id)
      if (local?.byteLength) return local
      const adapter = createStorageAdapter(requested)
      if (!adapter.getThumbnail) return null
      const remote = await adapter.getThumbnail(id)
      if (!remote?.byteLength) return null
      if (isCurrent(requested)) await localStore.writeThumb(id, remote)
      return remote
    }
  }
}
