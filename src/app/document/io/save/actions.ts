import type { EditorState } from '@open-pencil/core'
import { filesMessages } from '@open-pencil/vue/i18n'

import { downloadBlob } from '@/app/document/io/browser'
import { isFileWriteRefused } from '@/app/document/io/capability'
import { documentFileName, documentNameFromFigPath } from '@/app/document/io/names'
import { chooseBrowserFigSaveHandle, chooseTauriFigSavePath } from '@/app/document/io/save/targets'
import type { DocumentSourceAccess } from '@/app/document/io/types'
import { createDocumentWriter } from '@/app/document/io/write'
import { IS_TAURI } from '@/constants'

type SaveDocumentState = EditorState & { documentName: string }

type SaveActionsOptions = Omit<DocumentSourceAccess, 'getSavedVersion'> & {
  state: SaveDocumentState
  /** The document's content revision, recorded as the saved version. */
  version: () => number
  buildFigFile: () => Uint8Array | Promise<Uint8Array>
  startWatchingFile: () => void
  onWriteSuccess?: (version: number) => void | Promise<void>
  onDownloadSuccess?: (version: number) => void | Promise<void>
}

export function createSaveActions({
  state,
  version: currentVersion,
  buildFigFile,
  getFilePath,
  setFilePath,
  getFileHandle,
  setFileHandle,
  getDownloadName,
  setDownloadName,
  getStorageBinding,
  setStorageBinding,
  hasWritableSource,
  setSourceIdentity,
  setSavedVersion,
  setLastWriteTime,
  startWatchingFile,
  onWriteSuccess,
  onDownloadSuccess
}: SaveActionsOptions) {
  const writeFile = createDocumentWriter({
    state,
    getFilePath,
    getFileHandle,
    getStorageBinding,
    setSavedVersion,
    setLastWriteTime,
    onWriteSuccess
  })

  async function buildVersionedFigFile() {
    const version = currentVersion()
    return { data: await buildFigFile(), version }
  }

  async function saveFigFile() {
    const filePath = getFilePath()
    const fileHandle = getFileHandle()
    const storageBinding = getStorageBinding()
    const downloadName = getDownloadName()
    if (hasWritableSource()) {
      const { data, version } = await buildVersionedFigFile()
      const wrote = await writeFile(data, version)
      if (wrote && !storageBinding) setSourceIdentity({ handle: fileHandle, path: filePath })
      return wrote
    }
    if (downloadName) {
      const { data, version } = await buildVersionedFigFile()
      downloadBlob(new Uint8Array(data), downloadName, 'application/octet-stream')
      await onDownloadSuccess?.(version)
      return true
    }
    return saveFigFileAs()
  }

  async function saveFigFileAs() {
    const { data, version } = await buildVersionedFigFile()

    if (IS_TAURI) {
      const path = await chooseTauriFigSavePath(state.documentKind)
      if (!path) return false
      setStorageBinding(null)
      setFilePath(path)
      setFileHandle(null)
      state.documentName = documentNameFromFigPath(path)
      const wrote = await writeFile(data, version)
      if (wrote) setSourceIdentity({ handle: null, path })
      startWatchingFile()
      return wrote
    }

    // The picker helper returns null when the browser has no File System Access API.
    const handle = await chooseBrowserFigSaveHandle(state.documentKind)
    if (handle) {
      setStorageBinding(null)
      setFileHandle(handle)
      setFilePath(null)
      state.documentName = documentNameFromFigPath(handle.name)
      try {
        const wrote = await writeFile(data, version)
        if (wrote) setSourceIdentity({ handle, path: null })
        startWatchingFile()
        return wrote
      } catch (error) {
        if (!isFileWriteRefused(error)) throw error
        // The browser gave out the file but will not write to it: download it under that name,
        // and forget the file, so the tab is not taken for it.
        setFileHandle(null)
        setSourceIdentity({ handle: null, path: null })
        return downloadAs(handle.name, data, version)
      }
    }

    const filename = prompt(
      filesMessages.get().saveAsPrompt,
      getDownloadName() ?? documentFileName('Untitled', state.documentKind)
    )
    if (!filename) return false
    return downloadAs(filename, data, version)
  }

  async function downloadAs(filename: string, data: Uint8Array, version: number) {
    setStorageBinding(null)
    setDownloadName(filename)
    state.documentName = documentNameFromFigPath(filename)
    downloadBlob(new Uint8Array(data), filename, 'application/octet-stream')
    await onDownloadSuccess?.(version)
    return true
  }

  return { saveFigFile, saveFigFileAs, writeFile }
}
