import type { ObjectStore, StoredObject } from '../src/server'

export function createMemoryObjectStore() {
  const stored = new Map<string, StoredObject>()
  const deletedKeys: string[] = []
  const store: ObjectStore = {
    capabilities: {
      nativeSHA256: true,
      multipartUpload: false,
      conditionalWrites: false
    },
    async checkReadiness() {
      return { ok: true, checksumVerification: 'native' }
    },
    async createDownload(input) {
      return {
        url: `https://objects.example.com/${input.key}`,
        method: 'GET',
        headers: {},
        expiresAt: input.expiresAt.toISOString()
      }
    },
    async createUpload(input) {
      return {
        url: `https://objects.example.com/${input.key}`,
        method: 'PUT',
        headers: {
          'Content-Type': input.contentType,
          'x-amz-checksum-sha256': input.checksum
        },
        expiresAt: input.expiresAt.toISOString()
      }
    },
    async head(key) {
      return stored.get(key) ?? null
    },
    async delete(key) {
      stored.delete(key)
      deletedKeys.push(key)
    }
  }
  return {
    store,
    deletedKeys,
    put(key: string, object: StoredObject) {
      stored.set(key, object)
    }
  }
}
