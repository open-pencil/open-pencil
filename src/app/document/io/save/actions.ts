import type { EditorState } from '@open-pencil/core'
import { filesMessages } from '@open-pencil/vue/i18n'

import { downloadBlob } from '@/app/document/io/browser'
import { isFileWriteRefused } from '@/app/document/io/capability'
import { documentFileName, documentNameFromFigPath } from '@/app/document/io/names'
import { startSaveProgress, type SaveProgress } from '@/app/document/io/save/feedback'
import { chooseBrowserFigSaveHandle, chooseTauriFigSavePath } from '@/app/document/io/save/targets'
import type { DocumentSourceAccess } from '@/app/document/io/types'
import { createDocumentWriter } from '@/app/document/io/write'
import { rememberRecentFile } from '@/app/recent-files'
import { IS_TAURI } from '@/constants'

type SaveDocumentState = EditorState & { documentName: string }

type SaveActionsOptions = Omit<DocumentSourceAccess, 'getSavedVersion'> & {
  state: SaveDocumentState
  /** The document's content revision, recorded as the saved version. */
  version: () => number
  /** The `.fig`, encoded and compressed, streaming as its target writes it. */
  buildFigStream: () => Promise<ReadableStream<Uint8Array>>
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
    onFileReplaced: startWatchingFile,
    onWriteSuccess
  })

  async function buildVersionedFigStream() {
    const version = currentVersion()
    return { stream: await buildFigStream(), version }
  }

  /** Runs a save the person waits for, showing its progress once it takes a while. */
  async function withProgress<T>(save: (progress: SaveProgress) => Promise<T>): Promise<T> {
    const progress = startSaveProgress()
    try {
      return await save(progress)
    } finally {
      progress.end()
    }
  }

  function saveFigFile() {
    const filePath = getFilePath()
    const fileHandle = getFileHandle()
    const storageBinding = getStorageBinding()
    const downloadName = getDownloadName()
    if (hasWritableSource()) {
      return withProgress(async (progress) => {
        const { stream, version } = await buildVersionedFigStream()
        const wrote = await writeFile(progress.track(stream), version)
        if (wrote && !storageBinding) setSourceIdentity({ handle: fileHandle, path: filePath })
        return wrote
      })
    }
    if (downloadName) {
      return withProgress(async (progress) => {
        const { stream, version } = await buildVersionedFigStream()
        await download(downloadName, progress.track(stream))
        await onDownloadSuccess?.(version)
        return true
      })
    }
    return saveFigFileAs()
  }

  async function saveFigFileAs() {
    if (IS_TAURI) {
      const path = await chooseTauriFigSavePath(state.documentKind)
      if (!path) return false
      setStorageBinding(null)
      setFilePath(path)
      setFileHandle(null)
      state.documentName = documentNameFromFigPath(path)
      const wrote = await withProgress(async (progress) => {
        const { stream, version } = await buildVersionedFigStream()
        return writeFile(progress.track(stream), version)
      })
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
        const wrote = await withProgress(async (progress) => {
          const { stream, version } = await buildVersionedFigStream()
          return writeFile(progress.track(stream), version)
        })
        if (wrote) setSourceIdentity({ handle, path: null })
        startWatchingFile()
        return wrote
      } catch (error) {
        if (!isFileWriteRefused(error)) throw error
        // The browser gave out the file but will not write to it: download it under that name,
        // and forget the file, so the tab is not taken for it. The refused write may have read
        // part of the stream, so the download writes the document again.
        setFileHandle(null)
        setSourceIdentity({ handle: null, path: null })
        return downloadBuilt(handle.name)
      }
    }

    const filename = prompt(
      filesMessages.get().saveAsPrompt,
      getDownloadName() ?? documentFileName('Untitled', state.documentKind)
    )
    if (!filename) return false
    return downloadBuilt(filename)
  }

  async function download(filename: string, stream: ReadableStream<Uint8Array>) {
    downloadBlob(await new Response(stream).blob(), filename, 'application/octet-stream')
  }

  /** A download builds its stream only once the person has chosen the name. */
  async function downloadBuilt(filename: string): Promise<boolean> {
    return withProgress(async (progress) => {
      const { stream, version } = await buildVersionedFigStream()
      setStorageBinding(null)
      setDownloadName(filename)
      state.documentName = documentNameFromFigPath(filename)
      await download(filename, progress.track(stream))
      await onDownloadSuccess?.(version)
      return true
    })
  }

  return { saveFigFile, saveFigFileAs, writeFile }
}
