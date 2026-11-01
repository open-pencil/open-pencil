import type { DocumentKind } from '@open-pencil/scene-graph'

import type { StorageLocation } from '@/app/integrations/storage'
import { rememberRecentStorageDocument } from '@/app/recent-files'
import { createDocumentTab } from '@/app/tabs'

/**
 * Starts a design or a board that lives in a Cloud workspace or the storage bucket from its first
 * edit.
 */
export async function createStoredDocument(
  location: StorageLocation,
  kind: DocumentKind = 'design'
): Promise<void> {
  const { store } = createDocumentTab(kind)
  if (!(await store.saveFigFileToStorage(location))) return
  const binding = store.getStorageBinding()
  if (binding) rememberRecentStorageDocument(binding, store.state.documentName)
}
