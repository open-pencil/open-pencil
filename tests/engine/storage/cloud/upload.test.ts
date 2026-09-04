import { describe, expect, test } from 'bun:test'

import { uploadCloudObject } from '@/app/integrations/storage/cloud/upload'

const documentId = '22222222-2222-4222-8222-222222222222'
const checksum = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

function multipartUpload(id = 'upload-1') {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    upload: {
      kind: 'multipart' as const,
      uploadId: id,
      partSize: 2,
      parts: Array.from({ length: 4 }, (_, index) => ({
        partNumber: index + 1,
        url: `https://objects.example.com/${id}/${index + 1}`,
        method: 'PUT' as const,
        headers: {}
      })),
      expiresAt: '2026-01-01T00:15:00.000Z'
    }
  }
}

describe('Cloud multipart upload', () => {
  test('bounds concurrency and orders ETags after out-of-order completion', async () => {
    let active = 0
    let maximumActive = 0
    const result = await uploadCloudObject({
      cloud: { createUpload: async () => multipartUpload() },
      documentId,
      bytes: new Uint8Array(8),
      checksum,
      baseRevisionId: null,
      multipartConcurrency: 2,
      transport: {
        apiFetch: fetch,
        async objectFetch(input) {
          active++
          maximumActive = Math.max(maximumActive, active)
          const partNumber = Number(String(input).split('/').at(-1))
          await Bun.sleep((5 - partNumber) * 5)
          active--
          return new Response(null, { headers: { etag: `etag-${partNumber}` } })
        }
      }
    })
    expect(maximumActive).toBe(2)
    expect(result.multipart?.parts).toEqual([
      { partNumber: 1, etag: 'etag-1' },
      { partNumber: 2, etag: 'etag-2' },
      { partNumber: 3, etag: 'etag-3' },
      { partNumber: 4, etag: 'etag-4' }
    ])
  })

  test('retries transient part failures', async () => {
    let requests = 0
    await uploadCloudObject({
      cloud: { createUpload: async () => multipartUpload() },
      documentId,
      bytes: new Uint8Array(8),
      checksum,
      baseRevisionId: null,
      transport: {
        apiFetch: fetch,
        async objectFetch(input) {
          requests++
          const partNumber = Number(String(input).split('/').at(-1))
          if (partNumber === 1 && requests === 1) return new Response(null, { status: 503 })
          return new Response(null, { headers: { etag: `etag-${partNumber}` } })
        }
      }
    })
    expect(requests).toBe(5)
  })

  test('replaces an expired presigned upload session once', async () => {
    let sessions = 0
    const result = await uploadCloudObject({
      cloud: {
        async createUpload() {
          sessions++
          return multipartUpload(`upload-${sessions}`)
        }
      },
      documentId,
      bytes: new Uint8Array(8),
      checksum,
      baseRevisionId: null,
      transport: {
        apiFetch: fetch,
        async objectFetch(input) {
          if (String(input).includes('upload-1')) return new Response(null, { status: 403 })
          return new Response(null, {
            headers: { etag: `etag-${String(input).split('/').at(-1)}` }
          })
        }
      }
    })
    expect(sessions).toBe(2)
    expect(result.multipart?.uploadId).toBe('upload-2')
  })

  test('stops scheduling work after cancellation', async () => {
    const controller = new AbortController()
    let requests = 0
    await expect(
      uploadCloudObject({
        cloud: { createUpload: async () => multipartUpload() },
        documentId,
        bytes: new Uint8Array(8),
        checksum,
        baseRevisionId: null,
        signal: controller.signal,
        multipartConcurrency: 1,
        transport: {
          apiFetch: fetch,
          async objectFetch() {
            requests++
            controller.abort(new Error('cancelled'))
            return new Response(null, { headers: { etag: 'etag' } })
          }
        }
      })
    ).rejects.toThrow(/cancelled|aborted/i)
    expect(requests).toBe(1)
  })
})
