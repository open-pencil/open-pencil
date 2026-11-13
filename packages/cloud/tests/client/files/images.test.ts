import { describe, expect, test } from 'bun:test'

import { imageCommitBatches } from '#cloud/client'
import { CLOUD_API_MAX_BODY_BYTES, CLOUD_MAX_DOCUMENT_IMAGES } from '#cloud/contract'

describe('image commit batches', () => {
  test('keep every commit under the server’s body limit, in order', () => {
    // The most a save may add: every image a multipart upload with long ETags.
    const uploads = Array.from({ length: CLOUD_MAX_DOCUMENT_IMAGES }, (_, index) => ({
      uploadId: crypto.randomUUID(),
      checksum: `${'A'.repeat(43)}=`,
      multipart: {
        uploadId: `upload-${index}`,
        parts: Array.from({ length: 10 }, (_, part) => ({
          partNumber: part + 1,
          etag: 'e'.repeat(255)
        }))
      }
    }))
    const batches = imageCommitBatches(uploads)
    expect(batches.length).toBeGreaterThan(1)
    expect(batches.flat()).toEqual(uploads)
    for (const batch of batches) {
      const body = JSON.stringify({ uploads: batch })
      expect(new TextEncoder().encode(body).byteLength).toBeLessThan(CLOUD_API_MAX_BODY_BYTES)
    }
  })

  test('send a usual save in one commit', () => {
    const uploads = [{ uploadId: crypto.randomUUID(), checksum: `${'A'.repeat(43)}=` }]
    expect(imageCommitBatches(uploads)).toEqual([uploads])
  })
})
