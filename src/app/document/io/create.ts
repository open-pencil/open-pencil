import type { Editor, EditorState } from '@open-pencil/core/editor'
import { prefetchFigmaSchema } from '@open-pencil/core/kiwi'

import { createDocumentViewportActions, downloadBlob } from '@/app/document/io/browser'
import { createDOMOpenActions } from '@/app/document/io/dom'
import { createOpenActions, createReloadActions } from '@/app/document/io/read'
import { createDocumentSourceActions, createDocumentSourceState } from '@/app/document/io/source'
import type { ViewportSize } from '@/app/document/io/types'
import { createFileWatcher } from '@/app/document/io/watch'
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
    setSavedVersion: (version) => {
      sourceState.setSavedVersion(version)
      sourceActions.markDocumentSaved()
    },
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
  const { setViewportSize, fitCurrentPageToViewport } = createDocumentViewportActions(
    editor,
    viewportSize
  )
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
    downloadBlob,
    setViewportSize,
    fitCurrentPageToViewport,
    getDocumentFilePath: sourceState.getFilePath,
    getSourceIdentity: sourceState.getSourceIdentity,
    getStorageBinding: sourceState.getStorageBinding,
    getRecoveryId: sourceActions.getRecoveryId,
    adoptRecoverySnapshot: sourceActions.adoptRecoverySnapshot,
    persistRecoveryNow: sourceActions.persistRecoveryNow,
    discardRecovery: sourceActions.discardRecovery,
    setDocumentSource: sourceActions.setDocumentSource,
    setStorageDocumentSource: sourceActions.setStorageDocumentSource,
    setPlannedFilePath: sourceActions.setPlannedFilePath,
    startWatchingCurrentFile: sourceActions.startWatchingCurrentFile,
    disposeDocumentIO: sourceActions.disposeDocumentIO,
    openFigFile,
    openDOMFile,
    importDOMText,
    hasUnsavedChanges: sourceActions.hasUnsavedChanges,
    saveFigFile: sourceActions.saveFigFile,
    saveFigFileAs: sourceActions.saveFigFileAs
  }
}
