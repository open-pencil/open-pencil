import type { EditorStore } from '@/app/editor/session'
import { rememberRecentStorageDocument } from '@/app/recent-files'
import {
  keepBothVersions,
  kickSyncEngine,
  replaceStoredVersion,
  takeStoredVersion
} from '@/app/storage/sync'
import { reloadStorageDocumentInTab } from '@/app/tabs'

export type CloudConflictChoice = 'keep-both' | 'use-cloud' | 'use-mine'

/**
 * Resolves the open document's conflict. Keeping both moves the tab to the copy, which already
 * shows this device's edits; taking the server's version reloads the tab with it; replacing it
 * uploads this device's version over the newer one.
 */
export async function resolveCloudConflict(
  store: EditorStore,
  choice: CloudConflictChoice,
  copyName: string
): Promise<void> {
  const binding = store.getStorageBinding()
  if (!binding) return
  if (choice === 'keep-both') {
    const copyId = await keepBothVersions(binding.documentId, copyName)
    const copy = { ...binding, documentId: copyId }
    store.setStorageDocumentSource(copy, copyName)
    rememberRecentStorageDocument(copy, copyName)
  } else if (choice === 'use-cloud') {
    await takeStoredVersion(binding.documentId)
    await reloadStorageDocumentInTab(store)
  } else {
    await replaceStoredVersion(binding.documentId)
  }
  await kickSyncEngine()
}
