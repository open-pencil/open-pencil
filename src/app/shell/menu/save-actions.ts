import { openCloudSave } from '@/app/cloud/documents/save'
import type { EditorStore } from '@/app/editor/active-store'
import { saveDocumentToStorage } from '@/app/storage/workspace/save'

export function createSaveMenuActions(store: EditorStore) {
  return {
    save: () => void store.saveFigFile(),
    'save-as': () => void store.saveFigFileAs(),
    'save-to-storage': () => void saveDocumentToStorage(store),
    'save-to-cloud': () => openCloudSave(store)
  }
}
