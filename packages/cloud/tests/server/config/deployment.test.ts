import { describe, expect, test } from 'bun:test'

import { parse as parseTOML } from 'smol-toml'
import * as v from 'valibot'

import {
  cloudDeploymentConfigSchema,
  parseCloudDeploymentConfig,
  parseCloudDeploymentTOML
} from '@open-pencil/cloud/server'

const minimalSource = `
schema_version = 2

[deployment]
mode = "self-hosted"
public_url = "https://cloud.example.com"
app_url = "https://app.example.com"
trusted_origins = ["https://app.example.com"]

[authentication]
enrollment_mode = "approval"

[authentication.providers.google]

[object_storage]
endpoint = "https://objects.example.com"
region = "us-east-1"
bucket = "openpencil"
`

const environment = {
  DATABASE_URL: 'postgresql://user:password@database/openpencil',
  BETTER_AUTH_SECRET: 'auth-secret-at-least-32-characters-long',
  GOOGLE_CLIENT_ID: 'google-public-client-id',
  GOOGLE_CLIENT_SECRET: 'google-secret',
  S3_ACCESS_KEY_ID: 'access-key',
  S3_SECRET_ACCESS_KEY: 'secret-key'
}

const completeSource = `${minimalSource.replace(
  'trusted_origins = ["https://app.example.com"]',
  'trusted_origins = ["https://app.example.com"]\nindexing = "allow"'
)}

[authentication.trusted_proxies]
headers = ["cf-connecting-ip"]
addresses = ["192.0.2.10"]

[object_storage.credentials.session_token]
from_env = "CUSTOM_SESSION_TOKEN"

[workers.email]
batch_size = 20
interval_ms = 15000
lease_ms = 120000
maximum_attempts = 3

[workers.cleanup]
enabled = false
batch_size = 40
interval_ms = 45000
lease_ms = 180000
document_retention_days = 14

[technical_limits]
maximum_upload_bytes = 104857600
maximum_collaboration_message_bytes = 524288
maximum_connections_per_room = 250
`

describe('Cloud TOML deployment configuration', () => {
  test('uses conventional secret references without TOML boilerplate', () => {
    expect(parseCloudDeploymentTOML(minimalSource, environment)).toMatchObject({
      deployment: 'self-hosted',
      databaseURL: environment.DATABASE_URL,
      authSecret: environment.BETTER_AUTH_SECRET,
      enrollmentMode: 'approval',
      googleClientId: 'google-public-client-id',
      googleClientSecret: environment.GOOGLE_CLIENT_SECRET,
      s3AccessKeyId: environment.S3_ACCESS_KEY_ID,
      s3SecretAccessKey: environment.S3_SECRET_ACCESS_KEY
    })
  })

  test('normalizes complete operational and storage policy', () => {
    const config = parseCloudDeploymentTOML(completeSource, {
      ...environment,
      CUSTOM_SESSION_TOKEN: 'session-token'
    })
    expect(config).toMatchObject({
      indexingPolicy: 'allow',
      authTrustedIPHeaders: ['cf-connecting-ip'],
      authTrustedProxies: ['192.0.2.10'],
      s3SessionToken: 'session-token',
      emailBatchSize: 20,
      emailIntervalMs: 15_000,
      emailLeaseDurationMs: 120_000,
      emailMaximumAttempts: 3,
      cleanupEnabled: false,
      cleanupBatchSize: 40,
      cleanupIntervalMs: 45_000,
      cleanupLeaseDurationMs: 180_000,
      documentRetentionMs: 14 * 86_400_000,
      technicalLimits: {
        maximumUploadBytes: 104857600,
        maximumCollaborationMessageBytes: 524288,
        maximumConnectionsPerRoom: 250
      }
    })
  })

  test('supports explicit secret-reference names', () => {
    const input = parseTOML(minimalSource)
    const parsed = v.parse(cloudDeploymentConfigSchema, input)
    const custom = {
      ...parsed,
      authentication: {
        ...parsed.authentication,
        secret: { from_env: 'CUSTOM_AUTH_SECRET' }
      }
    }
    expect(
      parseCloudDeploymentConfig(custom, {
        ...environment,
        CUSTOM_AUTH_SECRET: 'custom-auth-secret-at-least-32-characters'
      }).authSecret
    ).toBe('custom-auth-secret-at-least-32-characters')
  })

  test('reports missing reference names without exposing values', () => {
    expect(() => parseCloudDeploymentTOML(minimalSource, {})).toThrow(
      'Required secret binding is unavailable: DATABASE_URL'
    )
  })

  test('rejects unsupported schema versions', () => {
    expect(() =>
      parseCloudDeploymentTOML(
        minimalSource.replace('schema_version = 2', 'schema_version = 1'),
        environment
      )
    ).toThrow()
    expect(() =>
      parseCloudDeploymentTOML(
        minimalSource.replace('schema_version = 2', 'schema_version = 3'),
        environment
      )
    ).toThrow()
  })
})
