import { describe, expect, test } from 'bun:test'

import type { StorageProviderRuntime } from '@/app/integrations/storage'
import { resolveBunnyS3Config } from '@/app/integrations/storage/bunny/config'

function bunnyRuntime(
  preferences: Readonly<Record<string, string>>,
  password = 'storage-zone-password'
): StorageProviderRuntime {
  return {
    preferences,
    resolveCredential(field) {
      return Promise.resolve(field === 'password' ? password : null)
    }
  }
}

describe('Bunny Storage adapter configuration', () => {
  test('maps Bunny fields to the shared S3 client configuration', async () => {
    const config = await resolveBunnyS3Config(
      bunnyRuntime({
        'storage-zone': 'openpencil-test2-s3',
        endpoint: 'https://de-s3.storage.bunnycdn.com/'
      })
    )

    expect(config).toEqual({
      endpoint: 'https://de-s3.storage.bunnycdn.com',
      bucket: 'openpencil-test2-s3',
      accessKeyId: 'openpencil-test2-s3',
      secretAccessKey: 'storage-zone-password',
      region: 'de'
    })
  })

  test('rejects Bunny native and non-Bunny endpoints', async () => {
    for (const endpoint of [
      'https://storage.bunnycdn.com',
      'https://s3.example.com',
      'https://de-s3.storage.bunnycdn.com/openpencil'
    ]) {
      await expect(
        resolveBunnyS3Config(
          bunnyRuntime({
            'storage-zone': 'openpencil-test2-s3',
            endpoint
          })
        )
      ).rejects.toThrow('Use the Bunny S3 endpoint')
    }
  })

  test('requires the Storage Zone password', async () => {
    await expect(
      resolveBunnyS3Config(
        bunnyRuntime(
          {
            'storage-zone': 'openpencil-test2-s3',
            endpoint: 'https://de-s3.storage.bunnycdn.com'
          },
          ''
        )
      )
    ).rejects.toThrow('Bunny Storage Zone password is required')
  })
})
