export type CloseChoice = 'save' | 'discard' | 'cancel'
export type CloseResult = 'saved' | 'discard' | 'cancel'

export interface ClosableDocument {
  hasUnsavedChanges(): boolean
  saveFigFile(): Promise<boolean>
}

export async function confirmDocumentClose(
  document: ClosableDocument,
  choose: () => Promise<CloseChoice>
): Promise<CloseResult> {
  if (!document.hasUnsavedChanges()) return 'saved'
  const choice = await choose()
  if (choice !== 'save') return choice
  const saved = await document.saveFigFile()
  return saved && !document.hasUnsavedChanges() ? 'saved' : 'cancel'
}
