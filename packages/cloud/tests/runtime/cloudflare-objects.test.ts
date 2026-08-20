import { describe, expect, test } from 'bun:test'

import {
  createCloudflareR2ObjectStore,
  type CloudflareR2Bucket,
  type CloudflareR2ObjectBody
} from '@open-pencil/cloud/runtime/cloudflare'

function memoryBucket() {
  const objects = new Map<
    string,
    { bytes: Uint8Array; metadata: Record<string, string>; type: string }
  >()
  const bucket: CloudflareR2Bucket = {
    async head(key) {
      const object = objects.get(key)
      return object
        ? {
            size: object.bytes.byteLength,
            customMetadata: object.metadata,
            httpMetadata: { contentType: object.type }
          }
        : null
    },
    async get(key): Promise<CloudflareR2ObjectBody | null> {
      const object = objects.get(key)
      return object
        ? {
            size: object.bytes.byteLength,
            customMetadata: object.metadata,
            httpMetadata: { contentType: object.type },
            body: new Blob([Uint8Array.from(object.bytes)]).stream()
          }
        : null
    },
    async put(key, value, options) {
      const bytes =
        value instanceof ReadableStream
          ? new Uint8Array(await new Response(value).arrayBuffer())
          : value instanceof ArrayBuffer
            ? new Uint8Array(value)
            : new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
      objects.set(key, {
        bytes,
        metadata: options?.customMetadata ?? {},
        type: options?.httpMetadata?.contentType ?? 'application/octet-stream'
      })
      return { size: bytes.byteLength }
    },
    async delete(key) {
      objects.delete(key)
    }
  }
  return { bucket, objects }
}

describe('Cloudflare R2 object store', () => {
  test('signs uploads and downloads and verifies object metadata', async () => {
    const memory = memoryBucket()
    const objects = createCloudflareR2ObjectStore({
      bucket: memory.bucket,
      publicURL: 'https://cloud.example.com',
      signingSecret: 'r2-test-secret-at-least-32-characters'
    })
    const expiresAt = new Date(Date.now() + 60_000)
    const upload = await objects.store.createUpload({
      key: 'documents/workspace/document.fig',
      byteSize: 3,
      checksum: 'checksum',
      contentType: 'application/octet-stream',
      expiresAt
    })
    expect(upload.kind).toBe('single')
    if (upload.kind !== 'single') return
    expect(
      await objects.handleRequest(
        new Request(upload.url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': '3' },
          body: Uint8Array.from([1, 2, 3])
        })
      )
    ).toMatchObject({ status: 204 })
    expect(await objects.store.head('documents/workspace/document.fig')).toEqual({
      byteSize: 3,
      checksum: 'checksum',
      checksumVerification: 'metadata',
      contentType: 'application/octet-stream'
    })
    const download = await objects.store.createDownload({
      key: 'documents/workspace/document.fig',
      expiresAt
    })
    const response = await objects.handleRequest(new Request(download.url))
    if (!response) throw new Error('R2 download was not handled')
    expect(response.status).toBe(200)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(Uint8Array.from([1, 2, 3]))
  })

  test('rejects expired and tampered object requests', async () => {
    const objects = createCloudflareR2ObjectStore({
      bucket: memoryBucket().bucket,
      publicURL: 'https://cloud.example.com',
      signingSecret: 'r2-test-secret-at-least-32-characters'
    })
    const download = await objects.store.createDownload({
      key: 'private.fig',
      expiresAt: new Date(Date.now() - 1)
    })
    expect((await objects.handleRequest(new Request(download.url)))?.status).toBe(403)
    const tampered = new URL(download.url)
    tampered.searchParams.set('expires', String(Date.now() + 60_000))
    expect((await objects.handleRequest(new Request(tampered)))?.status).toBe(403)
  })
})
