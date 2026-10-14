import { filesMessages } from '@open-pencil/vue'

import type { StorageProviderID } from '@/app/integrations/storage'
import { createCanvasId } from '@/app/storage/id'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { persistStorageCanvasLocally } from '@/app/storage/sync/persist'
import { enqueuePutMetadata, flushStorageSync } from '@/app/storage/sync/runtime'
import { emitStorageWorkspaceEvent } from '@/app/storage/workspace/events'
import { readLibraryDesign, type LibraryDesign } from '@/app/storage/workspace/open'
import { getTabsSnapshot } from '@/app/tabs'

/**
 * Figma's Rename and Duplicate on a file in Recents. Both work on the design's row on this device,
 * fetching it from storage first when it is not here yet, and sync like any other edit.
 */

/** Rename a design. An open tab of it takes the name too, so its next save keeps it. */
export async function renameDesign(
  design: LibraryDesign,
  providerId: StorageProviderID,
  name: string
): Promise<void> {
  const store = getLocalCanvasStore()
  if (!(await store.getMeta(design.id))) await readLibraryDesign(design, providerId)
  const meta = await store.getMeta(design.id)
  if (!meta || meta.name === name) return
  for (const tab of getTabsSnapshot()) {
    if (tab.store.getStorageBinding()?.documentId === design.id) tab.store.renameDocument(name)
  }
  const updated = await store.updateMeta(design.id, {
    name,
    updatedAt: new Date().toISOString(),
    revision: meta.revision + 1,
    syncStatus: meta.syncStatus === 'conflict' ? 'conflict' : 'pending'
  })
  if (!updated) return
  await enqueuePutMetadata(design.id, updated.revision)
  // An explicit action, not an autosave burst: it reaches storage now.
  await flushStorageSync(design.id)
  emitStorageWorkspaceEvent({
    providerId: updated.providerId,
    documentId: design.id,
    kind: 'changed'
  })
}

/** Copy a design to a new one named "<name> (Copy)", as Figma names it, and return its id. */
export async function duplicateDesign(
  design: LibraryDesign,
  providerId: StorageProviderID
): Promise<string> {
  const figBytes = await readLibraryDesign(design, providerId)
  const canvasId = createCanvasId()
  await persistStorageCanvasLocally({
    providerId,
    canvasId,
    name: filesMessages.get().duplicateName({ name: design.name || 'Untitled' }),
    figBytes
  })
  await flushStorageSync(canvasId)
  return canvasId
}
