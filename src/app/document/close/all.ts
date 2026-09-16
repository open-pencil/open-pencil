import type { ClosableDocument } from './controller'
import { requestDocumentClose } from './prompt'

interface OpenDocument extends ClosableDocument {
  state: { documentName: string }
  persistRecoveryNow(): Promise<void>
  discardRecovery(): Promise<void>
}

export async function confirmAllDocuments(
  getDocuments: () => OpenDocument[],
  confirm: typeof requestDocumentClose = requestDocumentClose
): Promise<boolean> {
  const documents = getDocuments()
  const discarded = new Set<OpenDocument>()
  function canClose() {
    const current = getDocuments()
    return (
      current.length === documents.length &&
      current.every(
        (document) =>
          documents.includes(document) && (discarded.has(document) || !document.hasUnsavedChanges())
      )
    )
  }
  for (const document of documents) {
    const choice = await confirm(document, document.state.documentName)
    if (choice === 'cancel') return false
    if (choice === 'discard') discarded.add(document)
  }
  if (!canClose()) return false
  for (const document of documents) {
    if (discarded.has(document)) await document.discardRecovery()
    else await document.persistRecoveryNow()
  }
  return canClose()
}
