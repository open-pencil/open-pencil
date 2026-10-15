import type { DocumentWorkspaceSource } from '@open-pencil/vue'

import { activeStorageProviderID, type StorageDocument } from '@/app/integrations/storage'
import { storagePreferencesComplete } from '@/app/integrations/storage/preferences'
import { currentStorageDestination } from '@/app/storage/destination'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import {
  enqueueDeleteCanvas,
  enqueuePutMetadata,
  flushStorageSync
} from '@/app/storage/sync/runtime'
import { emitStorageWorkspaceEvent, onStorageWorkspaceEvent } from '@/app/storage/workspace/events'
import { listedAtDestination, loadLibraryPreview } from '@/app/storage/workspace/source'
import { closeTab, getTabsSnapshot } from '@/app/tabs'

/**
 * Figma's trash: a design moved there leaves the library but keeps its data, here and in
 * storage, until it is restored or permanently deleted. The trash state is part of the design's
 * synced metadata, so other devices see it too.
 */

function announce(providerId: string, documentId: string): void {
  emitStorageWorkspaceEvent({ providerId, documentId, kind: 'changed' })
}

/** An open design keeps saving itself, so its tab closes first. */
async function closeDesign(id: string): Promise<void> {
  for (const tab of getTabsSnapshot()) {
    if (tab.store.getStorageBinding()?.documentId === id) await closeTab(tab.id)
  }
}

/** Record a trash change as a local edit, then queue its metadata-only commit. */
async function setTrashed(id: string, trashedAt: string | null): Promise<void> {
  const store = getLocalCanvasStore()
  const meta = await store.getMeta(id)
  if (!meta) return
  const updated = await store.updateMeta(id, {
    trashedAt,
    updatedAt: new Date().toISOString(),
    revision: meta.revision + 1,
    syncStatus: meta.syncStatus === 'conflict' ? 'conflict' : 'pending'
  })
  if (!updated) return
  await enqueuePutMetadata(id, updated.revision)
  // An explicit action, not an autosave burst: it reaches storage now, not after the spacing.
  await flushStorageSync(id)
  announce(updated.providerId, id)
}

export async function moveDesignToTrash(id: string): Promise<void> {
  await closeDesign(id)
  await setTrashed(id, new Date().toISOString())
}

export async function restoreDesign(id: string): Promise<void> {
  await setTrashed(id, null)
}

export async function deleteDesignPermanently(id: string): Promise<void> {
  const store = getLocalCanvasStore()
  const meta = await store.getMeta(id)
  if (!meta) return
  // A design never synced has nothing in storage to remove.
  if (meta.baseStateId === null && meta.lastSyncedAt === null) {
    await store.remove(id)
  } else {
    await store.tombstone(id)
    await enqueueDeleteCanvas(id)
  }
  announce(meta.providerId, id)
}

export async function emptyTrash(ids: readonly string[]): Promise<void> {
  for (const id of ids) await deleteDesignPermanently(id)
}

export type TrashedDesign = StorageDocument & { trashedAt: string }

/** The designs in the trash, most recently trashed first, slide decks included. */
export function createTrashSource(): DocumentWorkspaceSource<TrashedDesign> {
  return {
    subscribe(listener) {
      return onStorageWorkspaceEvent(() => listener())
    },
    async refresh() {
      const providerId = activeStorageProviderID.value
      const destination = storagePreferencesComplete(providerId)
        ? currentStorageDestination(providerId)
        : null
      return (await getLocalCanvasStore().listMetas())
        .flatMap((meta): TrashedDesign[] =>
          meta.providerId === providerId &&
          meta.trashedAt !== null &&
          listedAtDestination(meta, destination)
            ? [
                {
                  id: meta.id,
                  name: meta.name,
                  updatedAt: meta.updatedAt,
                  sourceFormat: meta.sourceFormat,
                  trashedAt: meta.trashedAt
                }
              ]
            : []
        )
        .sort((first, second) => second.trashedAt.localeCompare(first.trashedAt))
    },
    loadPreview: loadLibraryPreview
  }
}
