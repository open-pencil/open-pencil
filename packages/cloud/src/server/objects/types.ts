export type ObjectDownload = {
  url: string
  method: 'GET'
  headers: Readonly<Record<string, string>>
  expiresAt: string
}

export type ObjectStoreCapabilities = {
  nativeSHA256: boolean
  multipartUpload: boolean
  conditionalWrites: boolean
}

export type ObjectStoreReadiness = {
  ok: boolean
  checksumVerification: 'native' | 'metadata'
}

export type ObjectUploadPart = {
  partNumber: number
  url: string
  method: 'PUT'
  headers: Readonly<Record<string, string>>
}

export type ObjectMultipartUpload = {
  kind: 'multipart'
  uploadId: string
  partSize: number
  parts: ObjectUploadPart[]
  expiresAt: string
}

export type ObjectSingleUpload = {
  kind: 'single'
  url: string
  method: 'PUT'
  headers: Readonly<Record<string, string>>
  expiresAt: string
}

export type ObjectUpload = ObjectSingleUpload | ObjectMultipartUpload

export type CompletedObjectPart = { partNumber: number; etag: string }

export type CreateObjectDownloadInput = {
  key: string
  expiresAt: Date
}

export type CreateObjectUploadInput = CreateObjectDownloadInput & {
  byteSize: number
  checksum: string
  contentType: string
}

export type CompleteObjectUploadInput = {
  key: string
  uploadId: string
  parts: CompletedObjectPart[]
}

export type AbortObjectUploadInput = Omit<CompleteObjectUploadInput, 'parts'>

export type StoredObject = {
  byteSize: number
  checksum: string
  checksumVerification: 'native' | 'metadata'
  contentType: string
}

export interface ObjectStore {
  readonly capabilities: ObjectStoreCapabilities
  checkReadiness(): Promise<ObjectStoreReadiness>
  createDownload(input: CreateObjectDownloadInput): Promise<ObjectDownload>
  createUpload(input: CreateObjectUploadInput): Promise<ObjectUpload>
  completeUpload(input: CompleteObjectUploadInput): Promise<void>
  abortUpload(input: AbortObjectUploadInput): Promise<void>
  head(key: string): Promise<StoredObject | null>
  delete(key: string): Promise<void>
}
