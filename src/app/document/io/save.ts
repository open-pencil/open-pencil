import type { Editor, EditorState } from '@open-pencil/core/editor'

import type { CloudDocumentBinding } from '@/app/cloud/types'
import { downloadBlob } from '@/app/document/io/browser'
import { documentNameFromFigPath } from '@/app/document/io/names'
import { chooseBrowserFigSaveHandle, chooseTauriFigSavePath } from '@/app/document/io/save-targets'
import { createDocumentWriter } from '@/app/document/io/write'
import { promptText } from '@/app/shell/prompts'
import { IS_TAURI } from '@/constants'

type SaveDocumentState = EditorState & { documentName: string }

type SaveActionsOptions = {
  state: SaveDocumentState
  buildFigFile: () => Uint8Array | Promise<Uint8Array>
  getFilePath: () => string | null
  setFilePath: (path: string | null) => void
  getFileHandle: () => FileSystemFileHandle | null
  setFileHandle: (handle: FileSystemFileHandle | null) => void
  getDownloadName: () => string | null
  setDownloadName: (name: string | null) => void
  getCloudBinding: () => CloudDocumentBinding | null
  setCloudBinding: (binding: CloudDocumentBinding | null) => void
  setSavedVersion: (version: number) => void
  setLastWriteTime: (time: number) => void
  startWatchingFile: () => void
  getEditor?: () => Pick<Editor, 'graph' | 'renderer'> | null
}

export function createSaveActions({
  state,
  buildFigFile,
  getFilePath,
  setFilePath,
  getFileHandle,
  setFileHandle,
  getDownloadName,
  setDownloadName,
  getCloudBinding,
  setCloudBinding,
  setSavedVersion,
  setLastWriteTime,
  startWatchingFile,
  getEditor
}: SaveActionsOptions) {
  const writeFile = createDocumentWriter({
    state,
    getFilePath,
    getFileHandle,
    getCloudBinding,
    setSavedVersion,
    setLastWriteTime,
    getEditor
  })

  async function saveFigFile() {
    const filePath = getFilePath()
    const fileHandle = getFileHandle()
    const cloud = getCloudBinding()
    const downloadName = getDownloadName()
    if (cloud || filePath || fileHandle) {
      await writeFile(await buildFigFile())
    } else if (downloadName) {
      downloadBlob(new Uint8Array(await buildFigFile()), downloadName, 'application/octet-stream')
    } else {
      await saveFigFileAs()
    }
  }

  async function saveFigFileAs() {
    const data = await buildFigFile()

    if (IS_TAURI) {
      const path = await chooseTauriFigSavePath()
      if (!path) return
      setCloudBinding(null)
      setFilePath(path)
      setFileHandle(null)
      state.documentName = documentNameFromFigPath(path)
      await writeFile(data)
      startWatchingFile()
      return
    }

    if (window.showSaveFilePicker) {
      const handle = await chooseBrowserFigSaveHandle()
      if (!handle) return
      setCloudBinding(null)
      setFileHandle(handle)
      setFilePath(null)
      state.documentName = documentNameFromFigPath(handle.name)
      await writeFile(data)
      startWatchingFile()
      return
    }

    const filename = await promptText('Save as:', getDownloadName() ?? 'Untitled.fig')
    if (!filename) return
    setCloudBinding(null)
    setDownloadName(filename)
    state.documentName = documentNameFromFigPath(filename)
    downloadBlob(new Uint8Array(data), filename, 'application/octet-stream')
  }

  return { saveFigFile, saveFigFileAs, writeFile }
}
