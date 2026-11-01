import { openVersionDialog, openVersionHistory } from '@/app/cloud/integration'
import type { EditorStore } from '@/app/editor/active-store'
import { openSaveTo } from '@/app/storage/save-to/session'
import { showsDocument } from '@/app/tabs'

/** Runs a save only while a document is in front: Home and a New file tab have none. */
function onDocument(run: () => void): () => void {
  return () => {
    if (showsDocument()) run()
  }
}

export function createSaveMenuActions(store: EditorStore) {
  return {
    save: onDocument(() => void store.saveFigFile()),
    'save-as': onDocument(() => void store.saveFigFileAs()),
    'save-to': onDocument(() => void openSaveTo(store)),
    'save-version': onDocument(() => openVersionDialog(store)),
    'version-history': onDocument(() => openVersionHistory(store))
  }
}
