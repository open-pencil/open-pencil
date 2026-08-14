import { describe, expect, test } from 'bun:test'

import {
  CloudConfigError,
  cloudServerConfigFromEnvironment,
  parseCloudServerConfig
} from '@open-pencil/cloud/server'

const baseConfig = {
  deployment: 'self-hosted',
  publicURL: 'https://pencil.example.com',
  databaseURL: 'postgresql://openpencil:secret@database/openpencil',
  authSecret: 'a-secure-auth-secret-with-at-least-32-characters',
  s3Endpoint: 'https://objects.example.com',
  s3Region: 'us-east-1',
  s3Bucket: 'openpencil',
  s3AccessKeyId: 'access-key',
  s3SecretAccessKey: 'secret-key'
}

describe('Cloud server configuration', () => {
  test('accepts a self-hosted configuration without social providers', () => {
    expect(parseCloudServerConfig(baseConfig)).toMatchObject({
      deployment: 'self-hosted',
      trustedOrigins: []
    })
  })

  test('requires Google credentials together', () => {
    expect(() =>
      parseCloudServerConfig({ ...baseConfig, googleClientId: 'google-client' })
    ).toThrow(CloudConfigError)
  })

  test('requires all Apple signing fields together', () => {
    expect(() => parseCloudServerConfig({ ...baseConfig, appleClientId: 'apple-client' })).toThrow(
      CloudConfigError
    )
  })

  test('loads deployment configuration from environment variables', () => {
    const config = cloudServerConfigFromEnvironment({
      OPENPENCIL_CLOUD_URL: baseConfig.publicURL,
      DATABASE_URL: baseConfig.databaseURL,
      BETTER_AUTH_SECRET: baseConfig.authSecret,
      OPENPENCIL_CLOUD_TRUSTED_ORIGINS: 'https://app.example.com, https://desktop.example.com',
      S3_ENDPOINT: baseConfig.s3Endpoint,
      S3_REGION: baseConfig.s3Region,
      S3_BUCKET: baseConfig.s3Bucket,
      S3_ACCESS_KEY_ID: baseConfig.s3AccessKeyId,
      S3_SECRET_ACCESS_KEY: baseConfig.s3SecretAccessKey
    })

    expect(config.trustedOrigins).toEqual([
      'https://app.example.com',
      'https://desktop.example.com'
    ])
    expect(config).toMatchObject({
      cleanupEnabled: true,
      cleanupBatchSize: 100,
      cleanupIntervalMs: 60_000,
      cleanupLeaseDurationMs: 300_000
    })
  })

  test('rejects short auth secrets', () => {
    expect(() => parseCloudServerConfig({ ...baseConfig, authSecret: 'short' })).toThrow()
  })
})
