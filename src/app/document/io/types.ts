import type { StorageDocumentBinding } from '@/app/integrations/storage/types'

export type DocumentSourceIdentity = Readonly<{
  handle: FileSystemFileHandle | null
  path: string | null
}>

export type DocumentSourceAccess = {
  getFileHandle: () => FileSystemFileHandle | null
  setFileHandle: (handle: FileSystemFileHandle | null) => void
  getFilePath: () => string | null
  setFilePath: (path: string | null) => void
  getDownloadName: () => string | null
  setDownloadName: (name: string | null) => void
  getStorageBinding: () => StorageDocumentBinding | null
  setStorageBinding: (binding: StorageDocumentBinding | null) => void
  setSourceIdentity: (identity: DocumentSourceIdentity) => void
  getSavedVersion: () => number
  setSavedVersion: (version: number) => void
  setLastWriteTime: (time: number) => void
}

export type ViewportSize = { width: number; height: number }
