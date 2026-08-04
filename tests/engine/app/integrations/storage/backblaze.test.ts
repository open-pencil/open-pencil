import { describe, expect, test } from 'bun:test'

import type { StorageProviderRuntime } from '@/app/integrations/storage'
import { resolveBackblazeS3Config } from '@/app/integrations/storage/backblaze/config'

function backblazeRuntime(
  preferences: Readonly<Record<string, string>>,
  credentials: Readonly<Record<string, string>> = {
    'application-key-id': 'application-key-id-value',
    'application-key': 'application-key-value'
  }
): StorageProviderRuntime {
  return {
    preferences,
    resolveCredential(field) {
      return Promise.resolve(credentials[field] ?? null)
    }
  }
}

describe('Backblaze B2 adapter configuration', () => {
  test('maps Backblaze fields to the shared S3 client configuration', async () => {
    const config = await resolveBackblazeS3Config(
      backblazeRuntime({
        bucket: 'openpencil-test',
        endpoint: 'https://s3.us-west-004.backblazeb2.com/'
      })
    )

    expect(config).toEqual({
      endpoint: 'https://s3.us-west-004.backblazeb2.com',
      bucket: 'openpencil-test',
      accessKeyId: 'application-key-id-value',
      secretAccessKey: 'application-key-value',
      region: 'us-west-004'
    })
  })

  test('rejects native, virtual-hosted, insecure, and non-Backblaze endpoints', async () => {
    for (const endpoint of [
      'https://api005.backblazeb2.com',
      'https://openpencil-test.s3.us-west-004.backblazeb2.com',
      'http://s3.us-west-004.backblazeb2.com',
      'https://s3.example.com',
      'https://s3.us-west-004.backblazeb2.com/openpencil-test',
      'not a valid endpoint'
    ]) {
      await expect(
        resolveBackblazeS3Config(
          backblazeRuntime({
            bucket: 'openpencil-test',
            endpoint
          })
        )
      ).rejects.toThrow('Use the Backblaze S3 endpoint')
    }
  })

  test('requires both application key values', async () => {
    await expect(
      resolveBackblazeS3Config(
        backblazeRuntime(
          {
            bucket: 'openpencil-test',
            endpoint: 'https://s3.us-west-004.backblazeb2.com'
          },
          { 'application-key-id': 'application-key-id-value' }
        )
      )
    ).rejects.toThrow('Backblaze application key ID and application key are required')
  })
})
