import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { loadNodeCloudServerConfig } from '#cloud/runtime/node'

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
  test('ignores flat environment variables that the TOML file owns', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'openpencil-cloud-config-'))
    const path = join(directory, 'cloud.toml')
    try {
      await writeFile(path, source)
      const config = await loadNodeCloudServerConfig({
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

  test('requires a deployment TOML file', async () => {
    await expect(loadNodeCloudServerConfig(secrets)).rejects.toThrow('OPENPENCIL_CLOUD_CONFIG')
  })
})
