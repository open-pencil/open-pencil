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
