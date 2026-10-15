import type { EditorState } from '@open-pencil/core/editor'
import { filesMessages } from '@open-pencil/vue'

import { downloadBlob } from '@/app/document/io/browser'
import {
  FIG_FILE_TYPE,
  chooseBrowserFigSaveHandle,
  chooseTauriFigSavePath,
  type LocalFileType
} from '@/app/document/io/save-targets'
import type { DocumentSourceAccess } from '@/app/document/io/types'
import { createDocumentWriter } from '@/app/document/io/write'
import { IS_TAURI } from '@/constants'

type SaveDocumentState = EditorState & { documentName: string }

type SaveActionsOptions = Omit<DocumentSourceAccess, 'getSavedVersion'> & {
  state: SaveDocumentState
  /** The document's content revision, recorded as the saved version. */
  version: () => number
  buildFigFile: () => Uint8Array | Promise<Uint8Array>
  onWriteSuccess?: (version: number) => void | Promise<void>
  onDownloadSuccess?: (version: number) => void | Promise<void>
}

/**
 * Write bytes to a file of the user's choosing: the desktop save dialog, the browser's file
 * picker, or a download where the browser has no File System Access API.
 */
export async function saveLocalFile(
  data: Uint8Array,
  suggestedName: string,
  type: LocalFileType = FIG_FILE_TYPE
): Promise<boolean> {
  if (IS_TAURI) {
    const path = await chooseTauriFigSavePath(suggestedName, type)
    if (!path) return false
    const { writeFile: tauriWrite } = await import('@tauri-apps/plugin-fs')
    await tauriWrite(path, data)
    return true
  }

  // The picker helper returns null when the browser has no File System Access API.
  const handle = await chooseBrowserFigSaveHandle(suggestedName, type)
  if (handle) {
    const writable = await handle.createWritable()
    await writable.write(new Uint8Array(data))
    await writable.close()
    return true
  }

  const filename = prompt(filesMessages.get().saveAsPrompt, suggestedName)
  if (!filename) return false
  downloadBlob(new Uint8Array(data), filename, 'application/octet-stream')
  return true
}

export function createSaveActions({
  state,
  version: currentVersion,
  buildFigFile,
  getFilePath,
  getFileHandle,
  getDownloadName,
  getStorageBinding,
  setSourceIdentity,
  setSavedVersion,
  setLastWriteTime,
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
    if (storageBinding || filePath || fileHandle) {
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
    return saveLocalCopy()
  }

  /**
   * Figma's Save local copy…: write the design to a .fig file of the user's choosing. The design
   * stays in the library; the file is a copy and is not edited further.
   */
  async function saveLocalCopy(): Promise<boolean> {
    return saveLocalFile(await buildFigFile(), `${state.documentName || 'Untitled'}.fig`)
  }

  return { saveFigFile, saveLocalCopy, writeFile }
}
