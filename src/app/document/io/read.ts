import type { Editor, EditorState } from '@open-pencil/core/editor'

import { describeDiagnosticError, recordDocumentFailure } from '@/app/diagnostics'
import { yieldToUI } from '@/app/document/io/browser'
import { readFigDocument } from '@/app/document/io/fig'
import { applyImportedDocument } from '@/app/document/io/imported-document'
import { readReloadSource } from '@/app/document/io/reload-source'
import { captureReloadState, restoreReloadState } from '@/app/document/io/reload-state'
import type { EditorPreparationController } from '@/app/editor/preparation/controller'
import { notificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'

type OpenDocumentState = EditorState & {
  documentName: string
}

type ReloadDocumentState = EditorState & { documentName: string }

type OpenFigFileOptions = {
  editor: Editor
  state: OpenDocumentState
  setDocumentSource: (
    fileName: string,
    sourceFormat: string,
    handle?: FileSystemFileHandle,
    path?: string
  ) => void
  fitCurrentPageToViewport: () => Promise<void>
  preparationController: EditorPreparationController
}

type ReloadActionsOptions = {
  editor: Editor
  state: ReloadDocumentState
  getFilePath: () => string | null
  getFileHandle: () => FileSystemFileHandle | null
  markDocumentSaved: () => void
  preparationController: EditorPreparationController
}

export function createOpenActions({
  editor,
  state,
  setDocumentSource,
  fitCurrentPageToViewport,
  preparationController
}: OpenFigFileOptions) {
  async function openFigFile(file: File, handle?: FileSystemFileHandle, path?: string) {
    const load = preparationController.begin({ kind: 'document-open', subject: file.name })
    let succeeded = false
    try {
      load.update({ phase: 'reading', detail: file.name })
      await yieldToUI()
      load.update({ phase: 'decoding', detail: file.name })
      const imported = await readFigDocument(file, load.signal)
      await yieldToUI()
      load.update({ phase: 'materializing', detail: file.name })
      await applyImportedDocument(editor, imported, load)
      state.documentName = file.name.replace(/\.fig$/i, '')
      setDocumentSource(file.name, 'fig', handle, path)
      await fitCurrentPageToViewport()
      load.update({ phase: 'preparing-render', detail: state.documentName })
      editor.requestRender()
      succeeded = true
    } catch (e) {
      if (load.signal.aborted) return
      const diagnostic = describeDiagnosticError(e)
      load.fail({
        code: 'decode-failed',
        message: e instanceof Error ? e.message : String(e),
        retryable: diagnostic.retryable ?? true
      })
      recordDocumentFailure({
        operation: 'open',
        format: 'fig',
        ...diagnostic,
        retryable: diagnostic.retryable
      })
      console.error('Failed to open .fig file:', e)
      toast.error(
        notificationMessages.get().openFileFailed({
          name: file.name,
          error: e instanceof Error ? e.message : String(e)
        })
      )
    } finally {
      if (succeeded) load.complete()
    }
  }

  return { openFigFile }
}

export function createReloadActions({
  editor,
  state,
  getFilePath,
  getFileHandle,
  markDocumentSaved,
  preparationController
}: ReloadActionsOptions) {
  async function reloadFromDisk() {
    const load = preparationController.begin({
      kind: 'document-reload',
      subject: state.documentName
    })
    let succeeded = false
    try {
      const snapshot = captureReloadState(state)
      load.update({ phase: 'reading', detail: state.documentName })
      const imported = await readReloadSource({
        documentName: state.documentName,
        filePath: getFilePath(),
        fileHandle: getFileHandle(),
        signal: load.signal
      })
      if (!imported) {
        succeeded = true
        return
      }
      await applyImportedDocument(editor, imported, load)
      restoreReloadState(editor, state, snapshot)
      editor.requestRender()
      markDocumentSaved()
      succeeded = true
    } catch (error) {
      if (load.signal.aborted) return
      const diagnostic = describeDiagnosticError(error)
      load.fail({
        code: 'decode-failed',
        message: error instanceof Error ? error.message : String(error),
        retryable: diagnostic.retryable ?? true
      })
      recordDocumentFailure({
        operation: 'open',
        format: 'fig',
        ...diagnostic,
        retryable: diagnostic.retryable
      })
      toast.error(
        notificationMessages.get().openFileFailed({
          name: state.documentName,
          error: error instanceof Error ? error.message : String(error)
        })
      )
    } finally {
      if (succeeded) load.complete()
    }
  }

  return { reloadFromDisk }
}
