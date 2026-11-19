import {
  sameStorageDocument,
  sameStorageLocation,
  storageLocationOf,
  type StorageDocument,
  type StorageDocumentBinding,
  type StorageLocation
} from '@/app/integrations/storage'
import { forgetRecentStorageDocument } from '@/app/recent-files'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { enqueueDeleteCanvas } from '@/app/storage/sync'
import { emitStorageWorkspaceEvent } from '@/app/storage/workspace/events'
import { closeTab, getTabsSnapshot } from '@/app/tabs'

/**
 * Deletes a stored document for everyone, once the person has confirmed it. Home stops listing it at
 * once and the provider deletes it when the sync engine reaches the job, so a deletion made offline
 * or refused for now is kept until it goes through. The document's tabs in this window close last,
 * without asking, so a deletion that could not be recorded leaves their edits as they were.
 */
export async function deleteStoredDocument(
  document: StorageDocument,
  location: StorageLocation
): Promise<void> {
  const binding: StorageDocumentBinding = {
    ...storageLocationOf(location),
    documentId: document.id
  }
  const store = getLocalCanvasStore()
  // The sync engine finds the provider through the device's copy, which home seeds as it lists.
  const copy =
    (await store.getMeta(document.id)) ??
    (await store.upsertIndexMeta({
      id: document.id,
      ...storageLocationOf(location),
      name: document.name,
      updatedAt: document.updatedAt,
      syncStatus: 'synced',
      lastSyncedAt: document.updatedAt,
      lastSyncError: null,
      remoteRevision: document.revision ?? null
    }))
  // The job deletes wherever the copy lives, so a copy of another location is not this document.
  if (!sameStorageLocation(storageLocationOf(copy), location)) {
    throw new Error(`Document ${document.id} is stored in another location`)
  }
  await store.tombstone(document.id)
  try {
    await enqueueDeleteCanvas(document.id)
  } catch (error) {
    // Without its job the tombstone would hide a document that stays in storage. The sync state
    // goes back only if nothing was saved meanwhile, since a newer save has its own upload to make.
    await store.updateMeta(document.id, { tombstoned: copy.tombstoned })
    await store.updateMeta(
      document.id,
      { syncStatus: copy.syncStatus, updatedAt: copy.updatedAt },
      { expectedRevision: copy.revision }
    )
    throw error
  }
  forgetRecentStorageDocument(binding)
  emitStorageWorkspaceEvent({
    ...storageLocationOf(location),
    documentId: document.id,
    kind: 'changed'
  })
  // The deletion is recorded by now, so a tab that fails to close does not undo it.
  for (const tab of getTabsSnapshot()) {
    const open = tab.store.getStorageBinding()
    if (!open || !sameStorageDocument(open, binding)) continue
    await closeTab(tab.id, 'discard').catch((error: unknown) => {
      console.error('[Storage] Closing a deleted document’s tab failed:', error)
    })
  }
}
