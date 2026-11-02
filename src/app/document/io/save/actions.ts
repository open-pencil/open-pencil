import type { EditorState } from '@open-pencil/core'
import { filesMessages } from '@open-pencil/vue/i18n'

import { downloadBlob } from '@/app/document/io/browser'
import { isFileWriteRefused } from '@/app/document/io/capability'
import { documentFileName, documentNameFromFigPath } from '@/app/document/io/names'
import { chooseBrowserFigSaveHandle, chooseTauriFigSavePath } from '@/app/document/io/save/targets'
import type { DocumentSourceAccess } from '@/app/document/io/types'
import { androidDocumentName, createDocumentWriter } from '@/app/document/io/write'
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
      // Android's picker returns a document URI rather than a path: there is no path to
      // watch, and the name comes from the provider instead of from the string.
      const isDocumentURI = path.startsWith('content://')
      const previous = {
        filePath: getFilePath(),
        fileHandle: getFileHandle(),
        storageBinding: getStorageBinding(),
        downloadName: getDownloadName(),
        documentName: state.documentName
      }
      // The target is stored before the write is attempted. A write that fails would leave
      // the document pointing at a file it never wrote, and the next plain Save would keep
      // writing there, so the target is put back the way it was.
      const restore = () => {
        setStorageBinding(previous.storageBinding)
        setFileHandle(previous.fileHandle)
        setFilePath(previous.filePath)
        setDownloadName(previous.downloadName)
        state.documentName = previous.documentName
      }
      setStorageBinding(null)
      setFilePath(path)
      setFileHandle(null)
      if (isDocumentURI) {
        // The save sheet lets the person rename the file, so the editor takes the name the
        // provider now holds instead of keeping the one the document had before.
        const picked = await androidDocumentName(path)
        if (picked) state.documentName = documentNameFromFigPath(picked)
      } else {
        state.documentName = documentNameFromFigPath(path)
      }
      try {
        const wrote = await writeFile(data, version)
        if (!wrote) {
          restore()
          return false
        }
        setSourceIdentity({ handle: null, path })
        if (!isDocumentURI) startWatchingFile()
        return true
      } catch (error) {
        restore()
        throw error
      }
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
