import type { ObjectStore, StoredObject } from '../src/server'

export function createMemoryObjectStore() {
  const stored = new Map<string, StoredObject>()
  const store: ObjectStore = {
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
    }
  }
  return {
    store,
    put(key: string, object: StoredObject) {
      stored.set(key, object)
    }
  }
}
