import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resolveNodeCloudServerConfig } from '@open-pencil/cloud/runtime/node'

const source = `
schema_version = 2
[deployment]
mode = "self-hosted"
public_url = "https://toml.example.com"
indexing = "deny"
[authentication]
[object_storage]
endpoint = "https://objects.example.com"
region = "us-east-1"
bucket = "openpencil"
`

const secrets = {
  DATABASE_URL: 'postgresql://user:password@database/openpencil',
  BETTER_AUTH_SECRET: 'auth-secret-at-least-32-characters-long',
  S3_ACCESS_KEY_ID: 'access-key',
  S3_SECRET_ACCESS_KEY: 'secret-key'
}

describe('Node Cloud configuration', () => {
  test('uses TOML policy without flat environment overrides', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'openpencil-cloud-config-'))
    const path = join(directory, 'cloud.toml')
    try {
      await writeFile(path, source)
      const config = await resolveNodeCloudServerConfig({
        ...secrets,
        OPENPENCIL_CLOUD_CONFIG: path,
        OPENPENCIL_CLOUD_URL: 'https://ignored.example.com',
        OPENPENCIL_CLOUD_INDEXING_POLICY: 'allow'
      })
      expect(config.publicURL).toBe('https://toml.example.com')
      expect(config.indexingPolicy).toBe('deny')
    } finally {
      await rm(directory, { recursive: true })
    }
  })

  test('retains the legacy flat environment fallback', async () => {
    const config = await resolveNodeCloudServerConfig({
      ...secrets,
      OPENPENCIL_CLOUD_URL: 'https://legacy.example.com',
      S3_ENDPOINT: 'https://objects.example.com',
      S3_REGION: 'us-east-1',
      S3_BUCKET: 'openpencil'
    })
    expect(config.publicURL).toBe('https://legacy.example.com')
  })
})
