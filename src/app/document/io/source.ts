import { documentKindRules, type Editor, type EditorState } from '@open-pencil/core/editor'
import { exportDeckFile } from '@open-pencil/core/io/formats/deck'
import { exportFigFile } from '@open-pencil/core/io/formats/fig'

import { createAutosave } from '@/app/document/autosave'
import {
  documentNameFromFigPath,
  downloadNameFromPath,
  figDownloadName,
  isNativeDocumentFormat
} from '@/app/document/io/names'
import { createSaveActions } from '@/app/document/io/save'
import { createDocumentSourceState } from '@/app/document/io/source-state'
import type { DocumentSourceAccess } from '@/app/document/io/types'
import type {
  StorageDocumentBinding,
  StorageDocumentFormat
} from '@/app/integrations/storage/types'

type DocumentSourceState = EditorState & {
  documentName: string
  autosaveEnabled: boolean
}

export { createDocumentSourceState }

type DocumentSourceOptions = DocumentSourceAccess & {
  editor: Editor
  state: DocumentSourceState
  stopWatchingFile: () => void
  startWatchingFile: () => Promise<void>
  getRenderer: () => Editor['renderer']
}

export function createDocumentSourceActions({
  editor,
  state,
  stopWatchingFile,
  startWatchingFile,
  getFileHandle,
  setFileHandle,
  getFilePath,
  setFilePath,
  getDownloadName,
  setDownloadName,
  getStorageBinding,
  setStorageBinding,
  setSourceIdentity,
  getSavedVersion,
  setSavedVersion,
  setLastWriteTime,
  getRenderer
}: DocumentSourceOptions) {
  function currentSourceFormat(): string {
    return documentKindRules(state.documentKind).saveFormat
  }

  function buildNativeFile() {
    const renderer = getRenderer() ?? undefined
    // The exporter renders a thumbnail only when it has BOTH CanvasKit and a
    // renderer. Passing undefined here is why every browser-authored document
    // shipped a 1x1 placeholder — which then forced the workspace to download
    // whole documents just to draw its grid.
    const ck = renderer?.ck
    if (currentSourceFormat() === 'deck') {
      return exportDeckFile(
        editor.graph,
        ck,
        renderer,
        state.currentPageId,
        false,
        getDownloadName() || state.documentName
      )
    }
    return exportFigFile(editor.graph, ck, renderer, state.currentPageId)
  }

  // A document created blank has nothing worth keeping until it holds
  // something. Cleared on the first real write, after which it is an ordinary
  // document and saves like one — including when emptied again.
  let provisional = false

  /**
   * Both halves matter. `canUndo` alone would let a stage-colour change on an
   * empty canvas mint a document, and an empty canvas is not work. Objects
   * alone would let `requestRender()` — which bumps `sceneVersion` from over a
   * hundred call sites — save a document nobody touched.
   */
  function worthKeeping(): boolean {
    if (!provisional) return true
    if (!editor.undo.canUndo) return false
    return editor.graph.getPages().some((page) => editor.graph.getChildren(page.id).length > 0)
  }

  const { saveFigFile, saveFigFileAs, writeFile } = createSaveActions({
    state,
    buildFigFile: buildNativeFile,
    getFilePath,
    setFilePath,
    getFileHandle,
    setFileHandle,
    getDownloadName,
    setDownloadName,
    getStorageBinding,
    setStorageBinding,
    setSourceIdentity,
    // Every successful write funnels through here, whichever destination it
    // took, so this is the one place that can retire the provisional flag —
    // an explicit Save of a blank document is intent, and must stick.
    setSavedVersion: (version: number) => {
      provisional = false
      setSavedVersion(version)
    },
    setLastWriteTime,
    startWatchingFile: () => {
      void startWatchingFile()
    }
  })

  const { disposeAutosave, flushAutosave } = createAutosave({
    state,
    getSavedVersion,
    hasWritableSource: () => !!getFileHandle() || !!getFilePath() || !!getStorageBinding(),
    saveCurrentDocument: async () => {
      if (!worthKeeping()) return
      await writeFile(await buildNativeFile())
    }
  })

  function setDocumentSource(
    fileName: string,
    sourceFormat: string,
    handle?: FileSystemFileHandle,
    path?: string
  ) {
    stopWatchingFile()
    setStorageBinding(null)
    const isNative = isNativeDocumentFormat(sourceFormat)
    setFileHandle(isNative ? (handle ?? null) : null)
    setFilePath(isNative ? (path ?? null) : null)
    setDownloadName(figDownloadName(fileName, sourceFormat))
    setSourceIdentity({ handle: handle ?? null, path: path ?? null })
    setSavedVersion(state.sceneVersion)
    if (isNative && (handle || path)) {
      void startWatchingFile()
    }
  }

  function setStorageDocumentSource(
    binding: StorageDocumentBinding,
    documentName: string,
    sourceFormat: StorageDocumentFormat = 'fig',
    options: { provisional?: boolean } = {}
  ) {
    stopWatchingFile()
    setFileHandle(null)
    setFilePath(null)
    setDownloadName(`${documentName}.${sourceFormat}`)
    setSourceIdentity({ handle: null, path: null })
    setStorageBinding(binding)
    state.documentName = documentName
    state.autosaveEnabled = true
    setSavedVersion(state.sceneVersion)
    // Opening an existing document is never provisional: it earned its row
    // already, and emptying it must still be saved.
    provisional = options.provisional ?? false
  }

  function setPlannedFilePath(path: string) {
    stopWatchingFile()
    setStorageBinding(null)
    setFileHandle(null)
    setFilePath(path)
    const downloadName = downloadNameFromPath(path)
    setDownloadName(downloadName)
    state.documentName = documentNameFromFigPath(downloadName)
  }

  function startWatchingCurrentFile() {
    void startWatchingFile()
  }

  function disposeDocumentIO() {
    stopWatchingFile()
    disposeAutosave()
  }

  return {
    /** Serialise the open document in its own native format (.fig or .deck). */
    exportNativeDocument: buildNativeFile,
    setDocumentSource,
    setStorageDocumentSource,
    setPlannedFilePath,
    startWatchingCurrentFile,
    disposeDocumentIO,
    saveFigFile,
    saveFigFileAs,
    flushPendingSave: flushAutosave,
    getStorageBinding
  }
}
