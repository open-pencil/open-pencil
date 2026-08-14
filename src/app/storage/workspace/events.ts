import type { StorageProviderID } from '@/app/integrations/storage/types'

export type StorageWorkspaceEvent = {
  providerId: StorageProviderID
  documentId?: string
  kind: 'changed' | 'synced'
}

type StorageWorkspaceListener = (event: StorageWorkspaceEvent) => void

const listeners = new Set<StorageWorkspaceListener>()

export function emitStorageWorkspaceEvent(event: StorageWorkspaceEvent): void {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch (error) {
      console.error('[Storage] Workspace event listener failed:', error)
    }
  }
}

export function onStorageWorkspaceEvent(listener: StorageWorkspaceListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
