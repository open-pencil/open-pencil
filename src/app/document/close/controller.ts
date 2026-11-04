export type CloseChoice = 'save' | 'discard' | 'cancel'
export type CloseResult = 'saved' | 'discard' | 'cancel'

export interface ClosableDocument {
  state: { roomKeepsEdits: boolean }
  hasUnsavedChanges(): boolean
  saveFigFile(): Promise<boolean>
}

/** Whether closing the document would lose edits: none are lost that its room keeps. */
export function holdsUnkeptEdits(document: ClosableDocument): boolean {
  return document.hasUnsavedChanges() && !document.state.roomKeepsEdits
}

export async function confirmDocumentClose(
  document: ClosableDocument,
  choose: () => Promise<CloseChoice>
): Promise<CloseResult> {
  if (!document.hasUnsavedChanges()) return 'saved'
  if (document.state.roomKeepsEdits) {
    // The room keeps the edits whatever this save does; it only brings the stored file up to date.
    await document.saveFigFile().catch(() => false)
    // Unless the room lost them meanwhile, when the person decides as for any other document.
    if (!holdsUnkeptEdits(document)) return 'saved'
  }
  const choice = await choose()
  if (choice !== 'save') return choice
  const saved = await document.saveFigFile()
  return saved && !document.hasUnsavedChanges() ? 'saved' : 'cancel'
}
