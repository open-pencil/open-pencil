import type { Editor, EditorState } from '@open-pencil/core/editor'
import { prefetchFigmaSchema } from '@open-pencil/core/kiwi'

import { createDocumentViewportActions, downloadBlob } from '@/app/document/io/browser'
import { createDOMOpenActions } from '@/app/document/io/dom'
import { createOpenActions, createReloadActions } from '@/app/document/io/read'
import { createDocumentSourceActions, createDocumentSourceState } from '@/app/document/io/source'
import type { ViewportSize } from '@/app/document/io/types'
import { createFileWatcher } from '@/app/document/io/watch'

type DocumentIOState = EditorState & {
  documentName: string
  loading: boolean
  autosaveEnabled: boolean
}

export function createDocumentIOActions(
  editor: Editor,
  state: DocumentIOState,
  viewportSize: ViewportSize
) {
  const sourceState = createDocumentSourceState()

  void prefetchFigmaSchema()

  const { reloadFromDisk } = createReloadActions({
    editor,
    state,
    getFilePath: sourceState.getFilePath,
    getFileHandle: sourceState.getFileHandle,
    setSavedVersion: sourceState.setSavedVersion
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
    fitCurrentPageToViewport
  })
  const { openDOMFile, importDOMText } = createDOMOpenActions({
    editor,
    state,
    setDocumentSource: sourceActions.setDocumentSource,
    fitCurrentPageToViewport
  })

  return {
    downloadBlob,
    setViewportSize,
    fitCurrentPageToViewport,
    getDocumentFilePath: sourceState.getFilePath,
    setDocumentSource: sourceActions.setDocumentSource,
    setPlannedFilePath: sourceActions.setPlannedFilePath,
    startWatchingCurrentFile: sourceActions.startWatchingCurrentFile,
    disposeDocumentIO: sourceActions.disposeDocumentIO,
    openFigFile,
    openDOMFile,
    importDOMText,
    saveFigFile: sourceActions.saveFigFile,
    saveFigFileAs: sourceActions.saveFigFileAs
  }
}
