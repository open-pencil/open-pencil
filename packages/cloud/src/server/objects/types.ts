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

export type ObjectUpload = {
  url: string
  method: 'PUT'
  headers: Readonly<Record<string, string>>
  expiresAt: string
}

export type StoredObject = {
  byteSize: number
  checksum: string
  checksumVerification: 'native' | 'metadata'
  contentType: string
}

export interface ObjectStore {
  readonly capabilities: ObjectStoreCapabilities
  checkReadiness(): Promise<ObjectStoreReadiness>
  createDownload(input: { key: string; expiresAt: Date }): Promise<ObjectDownload>
  createUpload(input: {
    key: string
    byteSize: number
    checksum: string
    contentType: string
    expiresAt: Date
  }): Promise<ObjectUpload>
  head(key: string): Promise<StoredObject | null>
  delete(key: string): Promise<void>
}
