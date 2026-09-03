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
      indexingPolicy: 'deny',
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

  test('requires transport-specific transactional email configuration', () => {
    expect(() =>
      parseCloudServerConfig({
        ...baseConfig,
        emailTransport: 'cloudflare'
      })
    ).toThrow('requires an email from address')
    expect(() =>
      parseCloudServerConfig({
        ...baseConfig,
        emailTransport: 'smtp',
        emailFrom: 'cloud@example.com'
      })
    ).toThrow('SMTP configuration')
    expect(
      parseCloudServerConfig({
        ...baseConfig,
        emailTransport: 'cloudflare',
        emailFrom: 'notifications@mail.example.com'
      }).emailTransport
    ).toBe('cloudflare')
  })

  test('requires Cloudflare R2 S3 compatibility settings', () => {
    const r2 = {
      ...baseConfig,
      s3Endpoint: 'https://account-id.r2.cloudflarestorage.com',
      s3Region: 'auto',
      s3ForcePathStyle: false,
      s3ChecksumVerification: 'metadata' as const
    }
    expect(parseCloudServerConfig(r2)).toMatchObject(r2)
    expect(() => parseCloudServerConfig({ ...r2, s3Region: 'us-east-1' })).toThrow(
      'Cloudflare R2 S3 region must be auto'
    )
    expect(() => parseCloudServerConfig({ ...r2, s3ForcePathStyle: true })).toThrow(
      'Cloudflare R2 S3 endpoint must disable path-style requests'
    )
    expect(() => parseCloudServerConfig({ ...r2, s3ChecksumVerification: 'native' })).toThrow(
      'Cloudflare R2 checksum verification must use metadata'
    )
  })

  test('loads deployment configuration from environment variables', () => {
    const config = cloudServerConfigFromEnvironment({
      OPENPENCIL_CLOUD_URL: baseConfig.publicURL,
      DATABASE_URL: baseConfig.databaseURL,
      BETTER_AUTH_SECRET: baseConfig.authSecret,
      OPENPENCIL_CLOUD_TRUSTED_ORIGINS: 'https://app.example.com, https://desktop.example.com',
      OPENPENCIL_CLOUD_AUTH_IP_HEADERS: 'cf-connecting-ip',
      OPENPENCIL_CLOUD_AUTH_TRUSTED_PROXIES: '192.0.2.10, 10.0.0.0/24',
      OPENPENCIL_CLOUD_INDEXING_POLICY: 'allow',
      S3_ENDPOINT: baseConfig.s3Endpoint,
      S3_REGION: baseConfig.s3Region,
      S3_BUCKET: baseConfig.s3Bucket,
      S3_ACCESS_KEY_ID: baseConfig.s3AccessKeyId,
      S3_SECRET_ACCESS_KEY: baseConfig.s3SecretAccessKey
    })

    expect(config.indexingPolicy).toBe('allow')
    expect(config.trustedOrigins).toEqual([
      'https://app.example.com',
      'https://desktop.example.com'
    ])
    expect(config.authTrustedIPHeaders).toEqual(['cf-connecting-ip'])
    expect(config.authTrustedProxies).toEqual(['192.0.2.10', '10.0.0.0/24'])
    expect(config).toMatchObject({
      cleanupEnabled: true,
      cleanupBatchSize: 100,
      cleanupIntervalMs: 60_000,
      cleanupLeaseDurationMs: 300_000
    })
  })

  test('rejects malformed environment coercion instead of applying defaults', () => {
    const environment = {
      OPENPENCIL_CLOUD_URL: baseConfig.publicURL,
      DATABASE_URL: baseConfig.databaseURL,
      BETTER_AUTH_SECRET: baseConfig.authSecret,
      S3_ENDPOINT: baseConfig.s3Endpoint,
      S3_REGION: baseConfig.s3Region,
      S3_BUCKET: baseConfig.s3Bucket,
      S3_ACCESS_KEY_ID: baseConfig.s3AccessKeyId,
      S3_SECRET_ACCESS_KEY: baseConfig.s3SecretAccessKey
    }
    expect(() =>
      cloudServerConfigFromEnvironment({
        ...environment,
        OPENPENCIL_CLOUD_CLEANUP_ENABLED: 'yes'
      })
    ).toThrow()
    expect(() =>
      cloudServerConfigFromEnvironment({
        ...environment,
        OPENPENCIL_CLOUD_CLEANUP_BATCH_SIZE: '12.5'
      })
    ).toThrow()
  })

  test('rejects short auth secrets', () => {
    expect(() => parseCloudServerConfig({ ...baseConfig, authSecret: 'short' })).toThrow()
  })
})
