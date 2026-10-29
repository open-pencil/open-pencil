import { openVersionDialog, openVersionHistory } from '@/app/cloud/integration'
import type { EditorStore } from '@/app/editor/active-store'
import { openSaveTo } from '@/app/storage/save-to/session'

export function createSaveMenuActions(store: EditorStore) {
  return {
    save: () => void store.saveFigFile(),
    'save-as': () => void store.saveFigFileAs(),
    'save-to': () => void openSaveTo(store),
    'save-version': () => openVersionDialog(store),
    'version-history': () => openVersionHistory(store)
  }
}
