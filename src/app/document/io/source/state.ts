import { shallowRef } from 'vue'

import type { DocumentSourceIdentity } from '@/app/document/io/types'
import type { StorageDocumentBinding } from '@/app/integrations/storage/types'
import { isTauri } from '@/app/tauri/env'

export function createDocumentSourceState() {
  // Reactive, so the File menu follows a document saved to a file mid-session.
  const fileHandle = shallowRef<FileSystemFileHandle | null>(null)
  const filePath = shallowRef<string | null>(null)
  let downloadName: string | null = null
  let sourceIdentity: DocumentSourceIdentity = { handle: null, path: null }
  // Reactive too, so the status beside the name follows a document saved to storage.
  const storageBinding = shallowRef<StorageDocumentBinding | null>(null)
  let savedVersion = 0
  let lastWriteTime = 0

  return {
    getFileHandle: () => fileHandle.value,
    setFileHandle: (handle: FileSystemFileHandle | null) => {
      fileHandle.value = handle
    },
    getFilePath: () => filePath.value,
    setFilePath: (path: string | null) => {
      filePath.value = path
    },
    getDownloadName: () => downloadName,
    setDownloadName: (name: string | null) => {
      downloadName = name
    },
    getSourceIdentity: () => sourceIdentity,
    setSourceIdentity: (identity: DocumentSourceIdentity) => {
      sourceIdentity = identity
    },
    getStorageBinding: () => storageBinding.value,
    setStorageBinding: (binding: StorageDocumentBinding | null) => {
      storageBinding.value = binding
    },
    /**
     * Whether saving writes in place: to storage, a file the browser granted, or a desktop file. A
     * browser document's path is the URL it was opened from, which nothing can write to.
     */
    hasWritableSource: () =>
      !!storageBinding.value || !!fileHandle.value || (!!filePath.value && isTauri()),
    getSavedVersion: () => savedVersion,
    setSavedVersion: (version: number) => {
      savedVersion = version
    },
    getLastWriteTime: () => lastWriteTime,
    setLastWriteTime: (time: number) => {
      lastWriteTime = time
    }
  }
}
