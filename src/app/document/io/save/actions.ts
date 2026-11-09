import type { EditorState } from '@open-pencil/core'
import { filesMessages } from '@open-pencil/vue/i18n'

import { downloadBlob } from '@/app/document/io/browser'
import { bufferSource } from '@/app/document/io/bytes'
import { isFileWriteRefused } from '@/app/document/io/capability'
import { documentFileName, documentNameFromFigPath } from '@/app/document/io/names'
import { chooseBrowserFigSaveHandle, chooseTauriFigSavePath } from '@/app/document/io/save/targets'
import type { DocumentSourceAccess } from '@/app/document/io/types'
import { createDocumentWriter, type DocumentStream } from '@/app/document/io/write'
import { rememberRecentFile } from '@/app/recent-files'
import { IS_TAURI } from '@/constants'

type SaveDocumentState = EditorState & { documentName: string }

export interface SaveProgress {
  written: number
  total: number
}

type SaveActionsOptions = Omit<DocumentSourceAccess, 'getSavedVersion'> & {
  state: SaveDocumentState
  /** The document's content revision, recorded as the saved version. */
  version: () => number
  /** Builds the `.fig` and hands it to the target as it is produced. */
  buildFigStream: DocumentStream
  /** Reports a save in progress, and `null` once it ends. */
  onSaveProgress?: (progress: SaveProgress | null) => void
  startWatchingFile: () => void
  onWriteSuccess?: (version: number) => void | Promise<void>
  onDownloadSuccess?: (version: number) => void | Promise<void>
}

export function createSaveActions({
  state,
  version: currentVersion,
  buildFigStream,
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
  onSaveProgress,
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

  function reportProgress(written: number, total: number) {
    onSaveProgress?.({ written, total })
  }

  async function withProgress<T>(save: () => Promise<T>): Promise<T> {
    try {
      return await save()
    } finally {
      onSaveProgress?.(null)
    }
  }

  function writeCurrent(version: number) {
    return writeFile(buildFigStream, version, reportProgress)
  }

  async function saveFigFile() {
    return withProgress(async () => {
      const filePath = getFilePath()
      const fileHandle = getFileHandle()
      const storageBinding = getStorageBinding()
      const downloadName = getDownloadName()
      if (hasWritableSource()) {
        const version = currentVersion()
        const wrote = await writeCurrent(version)
        if (wrote && !storageBinding) setSourceIdentity({ handle: fileHandle, path: filePath })
        return wrote
      }
      if (downloadName) return downloadAs(downloadName)
      return saveFigFileAs()
    })
  }

  async function saveFigFileAs() {
    return withProgress(async () => {
      if (IS_TAURI) {
        const path = await chooseTauriFigSavePath(state.documentKind)
        if (!path) return false
        setStorageBinding(null)
        setFilePath(path)
        setFileHandle(null)
        state.documentName = documentNameFromFigPath(path)
        const wrote = await writeCurrent(currentVersion())
        if (wrote) {
          setSourceIdentity({ handle: null, path })
          // A file saved to disk is listed on Home like one opened from there.
          rememberRecentFile(path, state.documentKind)
        }
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
          const wrote = await writeCurrent(currentVersion())
          if (wrote) setSourceIdentity({ handle, path: null })
          startWatchingFile()
          return wrote
        } catch (error) {
          if (!isFileWriteRefused(error)) throw error
          // The browser gave out the file but will not write to it: download it under that name,
          // and forget the file, so the tab is not taken for it.
          setFileHandle(null)
          setSourceIdentity({ handle: null, path: null })
          return downloadAs(handle.name)
        }
      }

      const filename = prompt(
        filesMessages.get().saveAsPrompt,
        getDownloadName() ?? documentFileName('Untitled', state.documentKind)
      )
      if (!filename) return false
      return downloadAs(filename)
    })
  }

  async function downloadAs(filename: string): Promise<boolean> {
    const version = currentVersion()
    const chunks: Uint8Array[] = []
    await buildFigStream((chunk) => {
      chunks.push(chunk)
    }, reportProgress)
    const blob = new Blob(
      chunks.map((chunk) => bufferSource(chunk)),
      { type: 'application/octet-stream' }
    )
    setStorageBinding(null)
    setDownloadName(filename)
    state.documentName = documentNameFromFigPath(filename)
    downloadBlob(blob, filename, 'application/octet-stream')
    await onDownloadSuccess?.(version)
    return true
  }

  return { saveFigFile, saveFigFileAs, writeFile }
}
