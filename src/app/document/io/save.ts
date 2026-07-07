import type { EditorState } from '@open-pencil/core/editor'

import { downloadBlob } from '@/app/document/io/browser'
import { documentNameFromFigPath, downloadNameFromPath } from '@/app/document/io/names'
import { chooseBrowserFigSaveHandle, chooseTauriFigSavePath } from '@/app/document/io/save-targets'
import { createDocumentWriter } from '@/app/document/io/write'
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
  setSavedVersion: (version: number) => void
  setLastWriteTime: (time: number) => void
  startWatchingFile: () => void
  updateSourceIdentity: (fileName: string, handle?: FileSystemFileHandle, path?: string) => void
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
  setSavedVersion,
  setLastWriteTime,
  startWatchingFile,
  updateSourceIdentity
}: SaveActionsOptions) {
  const writeFile = createDocumentWriter({
    state,
    getFilePath,
    getFileHandle,
    setSavedVersion,
    setLastWriteTime
  })

  async function saveFigFile() {
    const filePath = getFilePath()
    const fileHandle = getFileHandle()
    const downloadName = getDownloadName()
    if (filePath || fileHandle) {
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
      const fileName = downloadNameFromPath(path)
      setFilePath(path)
      setFileHandle(null)
      state.documentName = documentNameFromFigPath(path)
      updateSourceIdentity(fileName, undefined, path)
      await writeFile(data)
      startWatchingFile()
      return
    }

    if (window.showSaveFilePicker) {
      const handle = await chooseBrowserFigSaveHandle()
      if (!handle) return
      setFileHandle(handle)
      setFilePath(null)
      state.documentName = documentNameFromFigPath(handle.name)
      updateSourceIdentity(handle.name, handle, undefined)
      await writeFile(data)
      startWatchingFile()
      return
    }

    const filename = prompt('Save as:', getDownloadName() ?? 'Untitled.fig')
    if (!filename) return
    setDownloadName(filename)
    state.documentName = documentNameFromFigPath(filename)
    updateSourceIdentity(filename, undefined, undefined)
    downloadBlob(new Uint8Array(data), filename, 'application/octet-stream')
  }

  return { saveFigFile, saveFigFileAs, writeFile }
}
