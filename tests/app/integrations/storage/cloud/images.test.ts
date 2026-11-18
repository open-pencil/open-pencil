import { describe, expect, test } from 'bun:test'

import { strToU8, unzipSync, zipSync } from 'fflate'

import { CLOUD_API_MAX_BODY_BYTES, CLOUD_MAX_DOCUMENT_IMAGES } from '@open-pencil/cloud/contract'

import {
  assembleCloudDocument,
  imageCommitBatches,
  splitCloudDocument
} from '@/app/integrations/storage/cloud/images'

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

describe('documents split for Cloud', () => {
  const image = new Uint8Array(4096).map((_, index) => index % 251)
  const meta = strToU8('{"file_name":"Doc"}')
  const file = zipSync({
    'canvas.fig': [strToU8('fig-kiwi'), { level: 0 }],
    'meta.json': meta,
    'images/abc123': [image, { level: 0 }]
  })

  test('take the images as views of the file and keep the rest in a lean archive', async () => {
    const { lean, images } = await splitCloudDocument(file)

    expect(images.map(({ name }) => name)).toEqual(['abc123'])
    expect(images[0]?.bytes).toEqual(image)
    expect(images[0]?.bytes.buffer).toBe(file.buffer)
    expect(unzipSync(lean)).toEqual({ 'canvas.fig': strToU8('fig-kiwi'), 'meta.json': meta })
  })

  test('open whole again with their images back in place', async () => {
    const { lean, images } = await splitCloudDocument(file)
    expect(unzipSync(await assembleCloudDocument(lean, images))).toEqual(unzipSync(file))
  })
})
