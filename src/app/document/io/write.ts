import type { EditorState } from '@open-pencil/core/editor'

import { describeDiagnosticError, recordDocumentFailure } from '@/app/diagnostics'
import type { StorageDocumentBinding } from '@/app/integrations/storage/types'
import { persistStorageCanvasLocally } from '@/app/storage/sync/persist'
import { isTauri } from '@/app/tauri/env'

type WriteDocumentState = EditorState & { documentName: string }

type DocumentWriterOptions = {
  state: WriteDocumentState
  getFilePath: () => string | null
  getFileHandle: () => FileSystemFileHandle | null
  getStorageBinding: () => StorageDocumentBinding | null
  setSavedVersion: (version: number) => void
  setLastWriteTime: (time: number) => void
  onWriteSuccess?: (version: number) => void | Promise<void>
}

export function createDocumentWriter({
  state,
  getFilePath,
  getFileHandle,
  getStorageBinding,
  setSavedVersion,
  setLastWriteTime,
  onWriteSuccess
}: DocumentWriterOptions) {
  async function finishWrite(version: number): Promise<true> {
    setSavedVersion(version)
    try {
      await onWriteSuccess?.(version)
    } catch (error) {
      console.warn('[Recovery] Cleanup after document write failed:', error)
    }
    return true
  }

  return async function writeFile(
    data: Uint8Array,
    version = state.sceneVersion
  ): Promise<boolean> {
    setLastWriteTime(Date.now())
    try {
      const storage = getStorageBinding()
      if (storage) {
        await persistStorageCanvasLocally({
          providerId: storage.providerId,
          canvasId: storage.documentId,
          name: state.documentName || 'Untitled',
          figBytes: data
        })
        return await finishWrite(version)
      }

      const filePath = getFilePath()
      const fileHandle = getFileHandle()
      if (filePath && isTauri()) {
        const { writeFile: tauriWrite } = await import('@tauri-apps/plugin-fs')
        await tauriWrite(filePath, data)
        return await finishWrite(version)
      }
      if (fileHandle) {
        const writable = await fileHandle.createWritable()
        await writable.write(new Uint8Array(data))
        await writable.close()
        return await finishWrite(version)
      }
      return false
    } catch (error) {
      recordDocumentFailure({
        operation: 'save',
        format: 'fig',
        ...describeDiagnosticError(error),
        retryable: describeDiagnosticError(error).retryable
      })
      throw error
    }
  }
}
