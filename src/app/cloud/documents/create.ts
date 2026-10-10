import type { StorageLocation } from '@/app/integrations/storage'
import { rememberRecentStorageDocument } from '@/app/recent-files'
import { createDocumentInCurrentTab } from '@/app/tabs'

/** Starts a design that lives in a Cloud workspace from its first edit. */
export async function createCloudDocument(location: StorageLocation): Promise<void> {
  const { store } = createDocumentInCurrentTab()
  if (!(await store.saveFigFileToStorage(location))) return
  const binding = store.getStorageBinding()
  if (binding) rememberRecentStorageDocument(binding, store.state.documentName)
}
