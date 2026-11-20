// A design kept in the storage bucket, such as Cloudflare R2, gets a `/design/<id>` address too: its
// ID is the stored document's, and this device's copy of it (`local-store`) says where it lives and
// what it is called, so a reload can open it again without listing the bucket. Cloud documents keep
// the addresses `address.ts` gives them.
import { isCloudBinding } from '@/app/cloud/integration'
import type { EditorStore } from '@/app/editor/session'
import { storageLocationOf } from '@/app/integrations/storage'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { openStorageDocumentInNewTab } from '@/app/tabs/open/storage'

/** The `/design/` ID of a tab's document kept in the storage bucket, otherwise null. */
export function storedDesignIdOf(store: Pick<EditorStore, 'getStorageBinding'>): string | null {
  const binding = store.getStorageBinding()
  if (!binding || isCloudBinding(binding)) return null
  return binding.documentId
}

/** This device's record of the stored design, when it has one and it was not deleted. */
async function storedDesignRecord(designId: string) {
  const meta = await getLocalCanvasStore().getMeta(designId)
  if (!meta || meta.tombstoned) return null
  if (isCloudBinding({ ...storageLocationOf(meta), documentId: meta.id })) return null
  return meta
}

/** Whether `designId` names a stored design this device can open again. */
export async function hasStoredDesign(designId: string): Promise<boolean> {
  return (await storedDesignRecord(designId)) !== null
}

/**
 * Opens the stored design in a tab from this device's copy, or downloads it when the copy is out
 * of date or was evicted. Returns false when this device knows no such design.
 */
export async function reopenStoredDesign(designId: string): Promise<boolean> {
  const meta = await storedDesignRecord(designId)
  if (!meta) return false
  await openStorageDocumentInNewTab(
    {
      id: meta.id,
      name: meta.name,
      updatedAt: meta.updatedAt,
      revision: meta.remoteRevision ?? null
    },
    storageLocationOf(meta)
  )
  return true
}
