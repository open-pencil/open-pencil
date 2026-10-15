export type CloseChoice = 'save' | 'discard' | 'cancel'
export type CloseResult = 'saved' | 'discard' | 'cancel'

export interface ClosableDocument {
  hasUnsavedChanges(): boolean
  saveFigFile(): Promise<boolean>
  /** A design in the library saves itself; closing it asks only when that save fails. */
  getStorageBinding?(): { documentId: string } | null
}

async function savedSilently(document: ClosableDocument): Promise<boolean> {
  if (!document.getStorageBinding?.()) return false
  try {
    return (await document.saveFigFile()) && !document.hasUnsavedChanges()
  } catch (error) {
    console.warn('[Library] Could not save the design before closing it', error)
    return false
  }
}

/**
 * A closing library design commits its last edits to storage now, rather than after the spacing
 * that keeps an open design's commits apart. Loaded on demand: storage sync is opt-in.
 */
function flushLibraryCommit(document: ClosableDocument): void {
  const binding = document.getStorageBinding?.()
  if (!binding) return
  void import('@/app/storage/sync/runtime')
    .then(({ flushStorageSync }) => flushStorageSync(binding.documentId))
    .catch((error: unknown) => {
      console.warn('[Library] Could not commit the design after closing it', error)
    })
}

export async function confirmDocumentClose(
  document: ClosableDocument,
  choose: () => Promise<CloseChoice>
): Promise<CloseResult> {
  const result = await chooseClose(document, choose)
  if (result === 'saved') flushLibraryCommit(document)
  return result
}

async function chooseClose(
  document: ClosableDocument,
  choose: () => Promise<CloseChoice>
): Promise<CloseResult> {
  if (!document.hasUnsavedChanges()) return 'saved'
  if (await savedSilently(document)) return 'saved'
  const choice = await choose()
  if (choice !== 'save') return choice
  const saved = await document.saveFigFile()
  return saved && !document.hasUnsavedChanges() ? 'saved' : 'cancel'
}
