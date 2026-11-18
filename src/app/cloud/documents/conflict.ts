import { shallowRef } from 'vue'

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

/** The tab whose conflict choice opens once its status shows, as a notification's click asks. */
export const conflictChoiceRequested = shallowRef<EditorStore | null>(null)

/** Opens the choice for `store`'s conflict, once its tab shows the document's status. */
export function requestConflictChoice(store: EditorStore): void {
  conflictChoiceRequested.value = store
}

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
    rememberRecentStorageDocument(copy, copyName, store.state.documentKind)
  } else if (choice === 'use-cloud') {
    await takeStoredVersion(binding.documentId)
    await reloadStorageDocumentInTab(store)
  } else {
    await replaceStoredVersion(binding.documentId)
  }
  await kickSyncEngine()
}
