import type { StorageDocument } from '@/app/integrations/storage'
import {
  activeStorageProviderID,
  createActiveStorageAdapter,
  storageCredentialStatuses,
  storagePreferencesComplete,
  storageProviderRegistry
} from '@/app/integrations/storage'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { reconcileStorageDocuments } from '@/app/storage/reconcile'
import { onStorageWorkspaceEvent } from '@/app/storage/workspace/events'

export type StorageWorkspaceSnapshot = {
  documents: StorageDocument[]
  configured: boolean
}

export function createStorageWorkspaceSource(
  onSnapshot: (snapshot: StorageWorkspaceSnapshot) => void
) {
  return {
    subscribe(listener: () => void): () => void {
      return onStorageWorkspaceEvent((event) => {
        if (event.providerId === activeStorageProviderID.value) listener()
      })
    },

    async refresh(): Promise<StorageDocument[] | null> {
      const providerID = activeStorageProviderID.value
      const provider = storageProviderRegistry.get(providerID)
      const statuses = await storageCredentialStatuses(providerID)
      const configured =
        storagePreferencesComplete(providerID) &&
        provider.credentialFields.every(
          (field) => !field.required || statuses[field.id] === 'configured'
        )
      const localStore = getLocalCanvasStore()
      const local = (await localStore.listMetas(true)).filter(
        (metadata) => metadata.providerId === providerID
      )
      if (!configured) {
        const documents = local
          .filter((metadata) => !metadata.tombstoned)
          .map((metadata) => ({
            id: metadata.id,
            name: metadata.name,
            updatedAt: metadata.updatedAt,
            metadataAuthoritative: true
          }))
        if (activeStorageProviderID.value !== providerID) return null
        onSnapshot({ documents, configured })
        return documents
      }

      const remote = await createActiveStorageAdapter(providerID).listDocuments()
      const reconciliation = reconcileStorageDocuments(local, remote)
      for (const id of reconciliation.localIdsToPurge) await localStore.remove(id)
      for (const document of reconciliation.remoteDocumentsToSeed) {
        await localStore.upsertIndexMeta({
          id: document.id,
          providerId: providerID,
          name: document.name,
          updatedAt: document.updatedAt,
          syncStatus: 'synced',
          lastSyncedAt: document.updatedAt,
          lastSyncError: null
        })
      }
      if (activeStorageProviderID.value !== providerID) return null
      onSnapshot({ documents: reconciliation.documents, configured })
      return reconciliation.documents
    },

    async loadPreview(id: string): Promise<Uint8Array | null> {
      const providerID = activeStorageProviderID.value
      const localStore = getLocalCanvasStore()
      const local = await localStore.readThumb(id)
      if (local?.byteLength) return local
      const adapter = createActiveStorageAdapter(providerID)
      if (!adapter.getThumbnail) return null
      const remote = await adapter.getThumbnail(id)
      if (!remote?.byteLength) return null
      if (activeStorageProviderID.value === providerID) await localStore.writeThumb(id, remote)
      return remote
    }
  }
}
