import type { ObjectStore, StoredObject } from '#cloud/server'

export function createMemoryObjectStore() {
  const stored = new Map<string, StoredObject>()
  const contents = new Map<string, Uint8Array>()
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
        kind: 'single',
        url: `https://objects.example.com/${input.key}`,
        method: 'PUT',
        headers: {
          'Content-Type': input.contentType,
          'x-amz-checksum-sha256': input.checksum
        },
        expiresAt: input.expiresAt.toISOString()
      }
    },
    completeUpload: async () => undefined,
    abortUpload: async () => undefined,
    async head(key) {
      return stored.get(key) ?? null
    },
    async delete(key) {
      stored.delete(key)
      contents.delete(key)
      deletedKeys.push(key)
    },
    async write({ key, bytes, contentType, checksum }) {
      stored.set(key, {
        byteSize: bytes.byteLength,
        checksum,
        checksumVerification: 'native',
        contentType
      })
      contents.set(key, Uint8Array.from(bytes))
    },
    async read(key) {
      return contents.get(key) ?? null
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
