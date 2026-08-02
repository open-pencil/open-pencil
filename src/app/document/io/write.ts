import { documentKindRules, type EditorState } from '@open-pencil/core/editor'

import type { StorageDocumentBinding } from '@/app/integrations/storage/types'
import { persistStorageCanvasLocally } from '@/app/storage/sync/persist'
import { extractStorageThumbnail } from '@/app/storage/thumbnail'
import { isTauri } from '@/app/tauri/env'

type WriteDocumentState = EditorState & { documentName: string }

type DocumentWriterOptions = {
  state: WriteDocumentState
  getFilePath: () => string | null
  getFileHandle: () => FileSystemFileHandle | null
  getStorageBinding: () => StorageDocumentBinding | null
  setSavedVersion: (version: number) => void
  setLastWriteTime: (time: number) => void
}

export function createDocumentWriter({
  state,
  getFilePath,
  getFileHandle,
  getStorageBinding,
  setSavedVersion,
  setLastWriteTime
}: DocumentWriterOptions) {
  return async function writeFile(data: Uint8Array): Promise<boolean> {
    setLastWriteTime(Date.now())
    const storage = getStorageBinding()
    if (storage) {
      await persistStorageCanvasLocally({
        providerId: storage.providerId,
        canvasId: storage.documentId,
        name: state.documentName || 'Untitled',
        sourceFormat: documentKindRules(state.documentKind).saveFormat,
        figBytes: data,
        thumbnailBytes: extractStorageThumbnail(data)
      })
      setSavedVersion(state.sceneVersion)
      return true
    }

    const filePath = getFilePath()
    const fileHandle = getFileHandle()
    if (filePath && isTauri()) {
      const { writeFile: tauriWrite } = await import('@tauri-apps/plugin-fs')
      await tauriWrite(filePath, data)
      setSavedVersion(state.sceneVersion)
      return true
    }
    if (fileHandle) {
      const writable = await fileHandle.createWritable()
      await writable.write(new Uint8Array(data))
      await writable.close()
      setSavedVersion(state.sceneVersion)
      return true
    }
    return false
  }
}
