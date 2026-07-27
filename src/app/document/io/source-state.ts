import type { DocumentSourceIdentity } from '@/app/document/io/types'
import type { StorageDocumentBinding } from '@/app/integrations/storage/types'

export function createDocumentSourceState() {
  let fileHandle: FileSystemFileHandle | null = null
  let filePath: string | null = null
  let downloadName: string | null = null
  let sourceIdentity: DocumentSourceIdentity = { handle: null, path: null }
  let storageBinding: StorageDocumentBinding | null = null
  let savedVersion = 0
  let lastWriteTime = 0

  return {
    getFileHandle: () => fileHandle,
    setFileHandle: (handle: FileSystemFileHandle | null) => {
      fileHandle = handle
    },
    getFilePath: () => filePath,
    setFilePath: (path: string | null) => {
      filePath = path
    },
    getDownloadName: () => downloadName,
    setDownloadName: (name: string | null) => {
      downloadName = name
    },
    getSourceIdentity: () => sourceIdentity,
    setSourceIdentity: (identity: DocumentSourceIdentity) => {
      sourceIdentity = identity
    },
    getStorageBinding: () => storageBinding,
    setStorageBinding: (binding: StorageDocumentBinding | null) => {
      storageBinding = binding
    },
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
