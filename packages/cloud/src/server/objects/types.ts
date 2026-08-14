export type ObjectDownload = {
  url: string
  method: 'GET'
  headers: Readonly<Record<string, string>>
  expiresAt: string
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
  contentType: string
}

export interface ObjectStore {
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
