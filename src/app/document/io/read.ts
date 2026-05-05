import type { Editor, EditorState } from '@open-pencil/core/editor'
import { readFigFile } from '@open-pencil/core/io/formats/fig'

import { yieldToUI } from '@/app/document/io/browser'
import { applyImportedDocument } from '@/app/document/io/imported-document'
import { readReloadSource } from '@/app/document/io/reload-source'
import { captureReloadState, restoreReloadState } from '@/app/document/io/reload-state'
import { toast } from '@/app/shell/ui'

type OpenDocumentState = EditorState & {
  documentName: string
  loading: boolean
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
}

type ReloadActionsOptions = {
  editor: Editor
  state: ReloadDocumentState
  getFilePath: () => string | null
  getFileHandle: () => FileSystemFileHandle | null
  setSavedVersion: (version: number) => void
}

export function createOpenActions({
  editor,
  state,
  setDocumentSource,
  fitCurrentPageToViewport
}: OpenFigFileOptions) {
  async function openFigFile(file: File, handle?: FileSystemFileHandle, path?: string) {
    try {
      state.loading = true
      await yieldToUI()
      const imported = await readFigFile(file, { populate: 'first-page' })
      await yieldToUI()
      await applyImportedDocument(editor, imported)
      state.documentName = file.name.replace(/\.fig$/i, '')
      setDocumentSource(file.name, 'fig', handle, path)
      await fitCurrentPageToViewport()
      editor.requestRender()
    } catch (e) {
      console.error('Failed to open .fig file:', e)
      toast.error(`Failed to open file: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      state.loading = false
    }
  }

  return { openFigFile }
}

export function createReloadActions({
  editor,
  state,
  getFilePath,
  getFileHandle,
  setSavedVersion
}: ReloadActionsOptions) {
  async function reloadFromDisk() {
    const snapshot = captureReloadState(state)
    const filePath = getFilePath()
    const fileHandle = getFileHandle()

    const imported = await readReloadSource({
      documentName: state.documentName,
      filePath,
      fileHandle
    })
    if (!imported) return
    editor.replaceGraph(imported)

    editor.undo.clear()
    setSavedVersion(state.sceneVersion)
    restoreReloadState(editor, state, snapshot)
    editor.requestRender()
  }

  return { reloadFromDisk }
}
