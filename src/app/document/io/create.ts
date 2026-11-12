import type { Editor, EditorState } from '@open-pencil/core'
import { prefetchFigmaSchema } from '@open-pencil/core/clipboard'

import { downloadBlob, fitPageToViewport } from '@/app/document/io/browser'
import { createDOMOpenActions } from '@/app/document/io/dom'
import { createOpenActions, createReloadActions } from '@/app/document/io/read'
import {
  createDocumentSourceActions,
  createDocumentSourceState
} from '@/app/document/io/source/actions'
import { createFileWatcher } from '@/app/document/io/watch/watcher'
import type { EditorPreparationController } from '@/app/editor/preparation/controller'

type DocumentIOState = EditorState & {
  documentName: string
  autosaveEnabled: boolean
  roomKeepsEdits: boolean
  showUI: boolean
}

export function createDocumentIOActions(
  editor: Editor,
  state: DocumentIOState,
  preparationController: EditorPreparationController
) {
  const sourceState = createDocumentSourceState()

  void prefetchFigmaSchema()

  const { reloadFromDisk } = createReloadActions({
    editor,
    state,
    getFilePath: sourceState.getFilePath,
    getFileHandle: sourceState.getFileHandle,
    hasUnsavedChanges: () => sourceActions.hasUnsavedChanges(),
    markDocumentSaved: () => sourceActions.markDocumentSaved(),
    preparationController
  })
  const { startWatchingFile, stopWatchingFile } = createFileWatcher({
    getFilePath: sourceState.getFilePath,
    getFileHandle: sourceState.getFileHandle,
    getLastWriteTime: sourceState.getLastWriteTime,
    reloadFromDisk: () => {
      void reloadFromDisk()
    }
  })
  const fitCurrentPageToViewport = (signal?: AbortSignal) => fitPageToViewport(editor, signal)
  const sourceActions = createDocumentSourceActions({
    editor,
    state,
    stopWatchingFile,
    startWatchingFile,
    getRenderer: () => editor.renderer,
    ...sourceState
  })
  const { openFigFile } = createOpenActions({
    editor,
    state,
    setDocumentSource: sourceActions.setDocumentSource,
    fitCurrentPageToViewport,
    preparationController
  })
  const { openDOMFile, importDOMText } = createDOMOpenActions({
    editor,
    state,
    setDocumentSource: sourceActions.setDocumentSource,
    fitCurrentPageToViewport,
    preparationController
  })

  return {
    renameDocument: sourceActions.renameDocument,
    onDocumentRenamed: sourceActions.onDocumentRenamed,
    downloadBlob,
    fitCurrentPageToViewport,
    getDocumentFilePath: sourceState.getFilePath,
    getDocumentFileHandle: sourceState.getFileHandle,
    /**
     * Reads the file again, as when git replaced it under an open document. The promise is handed
     * back: a caller that just replaced the file waits for the document to hold it again, rather
     * than for the read to be somewhere in flight while it reports the work done.
     */
    reloadDocumentFromDisk: () => reloadFromDisk(),
    getSourceIdentity: sourceState.getSourceIdentity,
    getStorageBinding: sourceState.getStorageBinding,
    hasWritableSource: sourceState.hasWritableSource,
    getRecoveryId: sourceActions.getRecoveryId,
    adoptRecoverySnapshot: sourceActions.adoptRecoverySnapshot,
    persistRecoveryNow: sourceActions.persistRecoveryNow,
    discardRecovery: sourceActions.discardRecovery,
    setDocumentSource: sourceActions.setDocumentSource,
    setStorageDocumentSource: sourceActions.setStorageDocumentSource,
    setPlannedFilePath: sourceActions.setPlannedFilePath,
    saveFigFileToPath: sourceActions.saveFigFileToPath,
    saveFigFileCopy: sourceActions.saveFigFileCopy,
    saveFigFileToStorage: sourceActions.saveFigFileToStorage,
    startWatchingCurrentFile: sourceActions.startWatchingCurrentFile,
    disposeDocumentIO: sourceActions.disposeDocumentIO,
    openFigFile,
    openDOMFile,
    importDOMText,
    hasUnsavedChanges: sourceActions.hasUnsavedChanges,
    markDocumentSaved: () => sourceActions.markDocumentSaved(),
    markDocumentChanged: sourceActions.markDocumentChanged,
    adoptChanges: sourceActions.adoptChanges,
    saveFigFile: sourceActions.saveFigFile,
    saveFigFileAs: sourceActions.saveFigFileAs
  }
}
