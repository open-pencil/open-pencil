import { afterEach, describe, expect, test } from 'bun:test'

import {
  deleteObject as appwriteDeleteObject,
  type AppwriteConfig
} from '@/app/integrations/storage/appwrite/client'
import { deleteObject as s3DeleteObject } from '@/app/integrations/storage/s3/client'
import type { S3CompatibleConfig } from '@/app/integrations/storage/s3/types'

const S3: S3CompatibleConfig = {
  endpoint: 'https://s3.example.test',
  bucket: 'bucket-1',
  accessKeyId: 'key-id',
  secretAccessKey: 'secret'
}

const APPWRITE: AppwriteConfig = {
  endpoint: 'https://fra.cloud.appwrite.io/v1',
  projectId: 'project-1',
  bucketId: 'bucket-1',
  apiKey: 'appwrite-api-key'
}

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

function answerWith(response: () => Response): void {
  globalThis.fetch = (async () => response()) as typeof fetch
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

/**
 * A delete retried after an ambiguous 5xx meets a 404: the object is already
 * gone, which is the outcome the delete wanted. Treating it as failure would
 * park the job as `not-found` and report a healthy delete as broken. Bunny and
 * Backblaze inherit the S3 client — their adapters only supply configuration —
 * so the S3 case covers them structurally.
 */
describe('delete idempotency', () => {
  test('S3 deleteObject tolerates a 404', async () => {
    answerWith(() => new Response('Not Found', { status: 404 }))
    await expect(
      s3DeleteObject(S3, 'open_pencil_storage/canvases/doc.fig')
    ).resolves.toBeUndefined()
  })

  test('S3 deleteObject still fails on a real error', async () => {
    answerWith(() => new Response('Forbidden', { status: 403 }))
    await expect(s3DeleteObject(S3, 'open_pencil_storage/canvases/doc.fig')).rejects.toThrow()
  })

  test('Appwrite deleteObject tolerates a missing file', async () => {
    answerWith(() => json({ type: 'storage_file_not_found' }, 404))
    await expect(
      appwriteDeleteObject(APPWRITE, 'bucket-1', 'open_pencil_storage/canvases/doc.fig')
    ).resolves.toBeUndefined()
  })

  test('Appwrite deleteObject distinguishes a missing bucket from a missing file', async () => {
    answerWith(() => json({ type: 'storage_bucket_not_found' }, 404))
    await expect(
      appwriteDeleteObject(APPWRITE, 'bucket-1', 'open_pencil_storage/canvases/doc.fig')
    ).rejects.toThrow(/bucket/i)
  })
})
