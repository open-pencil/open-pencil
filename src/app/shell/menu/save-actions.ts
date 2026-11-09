import { isCanvasTextInput } from '@open-pencil/vue/canvas/text-edit'

import { openVersionDialog, openVersionHistory, saveDocument } from '@/app/cloud/integration'
import type { EditorStore } from '@/app/editor/active-store'
import { openSaveTo } from '@/app/storage/save-to/session'
import { showsDocument } from '@/app/tabs'

/**
 * Commits the field being typed in, such as a layer name or a number, which commit on blur, so a
 * save writes what the field shows rather than its previous value. Text edited on the canvas is
 * written to the document as it is typed and keeps its focus.
 */
export function commitFocusedField(): void {
  if (typeof document === 'undefined') return
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || isCanvasTextInput(active)) return
  const typing =
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active.isContentEditable
  if (typing) active.blur()
}

/**
 * Runs a save only while a document is in front: Home and a New file tab have none. A field still
 * being typed in commits first, whether the save came from a menu or a key.
 */
function onDocument(run: () => void): () => void {
  return () => {
    if (!showsDocument()) return
    commitFocusedField()
    run()
  }
}

export function createSaveMenuActions(store: EditorStore) {
  return {
    save: onDocument(() => void saveDocument(store)),
    'save-as': onDocument(() => void store.saveFigFileAs()),
    'save-to': onDocument(() => void openSaveTo(store)),
    'save-version': onDocument(() => openVersionDialog(store)),
    'version-history': onDocument(() => openVersionHistory(store))
  }
}
