import { describe, expect, test } from 'bun:test'

import type { CloudDeploymentConfig } from '@open-pencil/cloud/server'

import { generateCloudflareConfig } from '../src/cloudflare-config'

const deployment = {
  schema_version: 2,
  deployment: {
    mode: 'official',
    public_url: 'https://cloud.example.com',
    indexing: 'deny',
    trusted_origins: []
  },
  database: { url: { from_env: 'DATABASE_URL' } },
  authentication: {
    secret: { from_env: 'BETTER_AUTH_SECRET' },
    enrollment_mode: 'approval',
    admin_notification_emails: [],
    admin_user_ids: [],
    trusted_proxies: { headers: [], addresses: [] },
    providers: {}
  },
  object_storage: {
    endpoint: 'https://objects.example.com',
    region: 'us-east-1',
    bucket: 'openpencil',
    credentials: {
      access_key_id: { from_env: 'S3_ACCESS_KEY_ID' },
      secret_access_key: { from_env: 'S3_SECRET_ACCESS_KEY' }
    },
    force_path_style: true,
    checksum_verification: 'native'
  },
  email: { transport: 'none' }
} satisfies CloudDeploymentConfig

describe('Cloudflare deployment configuration generation', () => {
  test('injects validated deployment policy without dropping JSONC configuration', () => {
    const generated = generateCloudflareConfig(
      deployment,
      `{
        // Platform bindings remain in Wrangler.
        "main": "worker.ts",
        "env": {
          "staging": {
            "routes": [{ "pattern": "cloud.example.com" }],
          },
        },
      }`,
      'staging'
    )
    expect(generated).toMatchObject({
      main: 'worker.ts',
      env: {
        staging: {
          routes: [{ pattern: 'cloud.example.com' }],
          vars: { OPENPENCIL_CLOUD_CONFIG: deployment }
        }
      }
    })
  })

  test('rejects malformed JSONC and unknown environments', () => {
    expect(() => generateCloudflareConfig(deployment, '{', 'staging')).toThrow(
      'Invalid Wrangler JSONC'
    )
    expect(() => generateCloudflareConfig(deployment, '{ "env": {} }', 'production')).toThrow(
      'Wrangler environment is unavailable: production'
    )
  })
})
