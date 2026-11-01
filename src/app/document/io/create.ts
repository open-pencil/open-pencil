import type { Editor, EditorState } from '@open-pencil/core'
import { prefetchFigmaSchema } from '@open-pencil/core/clipboard'

import { createDocumentViewportActions, downloadBlob } from '@/app/document/io/browser'
import { createDOMOpenActions } from '@/app/document/io/dom'
import { createOpenActions, createReloadActions } from '@/app/document/io/read'
import {
  createDocumentSourceActions,
  createDocumentSourceState
} from '@/app/document/io/source/actions'
import type { ViewportSize } from '@/app/document/io/types'
import { createFileWatcher } from '@/app/document/io/watch/watcher'
import type { EditorPreparationController } from '@/app/editor/preparation/controller'

type DocumentIOState = EditorState & {
  documentName: string
  autosaveEnabled: boolean
}

export function createDocumentIOActions(
  editor: Editor,
  state: DocumentIOState,
  viewportSize: ViewportSize,
  preparationController: EditorPreparationController
) {
  const sourceState = createDocumentSourceState()

  void prefetchFigmaSchema()

  const { reloadFromDisk } = createReloadActions({
    editor,
    state,
    getFilePath: sourceState.getFilePath,
    getFileHandle: sourceState.getFileHandle,
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
  const { setViewportSize, getViewportSize, fitCurrentPageToViewport } =
    createDocumentViewportActions(editor, viewportSize)
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
    setViewportSize,
    getViewportSize,
    fitCurrentPageToViewport,
    getDocumentFilePath: sourceState.getFilePath,
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
