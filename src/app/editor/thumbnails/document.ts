import type { EditorStore } from '@/app/editor/active-store'

/**
 * The document half of a thumbnail cache key.
 *
 * Prefers the workspace's own document id, which survives a rename. Keying on the display
 * name meant renaming a deck orphaned every thumbnail it had, and nothing could ever match
 * those rows again: three generations of one file — `OpenPencil-Slides`,
 * `OpenPencil-Slides (my changes)`, `OpenPencil Demo` — were each holding rows in the same
 * fixed-size store, crowding out thumbnails still in use.
 *
 * A document with no workspace row yet still falls back to its path or name, which is
 * stable for as long as such a document exists.
 */
export function thumbnailDocumentId(editor: EditorStore): string {
  return (
    editor.getStorageBinding()?.documentId ||
    editor.getDocumentFilePath() ||
    editor.state.documentName ||
    'untitled'
  )
}
