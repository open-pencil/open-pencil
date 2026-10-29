import type { EditorStore } from '@/app/editor/session'
import type { StorageDocumentBinding, StorageLocation } from '@/app/integrations/storage'
import { rememberRecentStorageDocument } from '@/app/recent-files'

/**
 * Saves the tab's document to a storage location under a new name, and moves the tab to the saved
 * copy, which this device keeps and uploads from then on. Returns the copy, or null when nothing
 * was saved, in which case the tab keeps the name it had. The file it came from is left as it was.
 */
export async function writeDocumentTo(
  store: EditorStore,
  location: StorageLocation,
  name: string
): Promise<StorageDocumentBinding | null> {
  const previousName = store.state.documentName
  store.state.documentName = name
  // Writing this device's copy or queueing its upload can throw rather than answer false.
  const saved = await store.saveFigFileToStorage(location).catch(() => false)
  const binding = saved ? store.getStorageBinding() : null
  if (!binding) {
    store.state.documentName = previousName
    return null
  }
  rememberRecentStorageDocument(binding, name)
  return binding
}
