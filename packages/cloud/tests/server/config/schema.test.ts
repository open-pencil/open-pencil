import { describe, expect, test } from 'bun:test'

import { CloudConfigError, parseCloudServerConfig } from '#cloud/server'

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

/** What every official deployment sets: administrators confirm a second step. */
const officialMFA = { deployment: 'official', deploymentAdminMFARequired: true, totpEnabled: true }

describe('Cloud server configuration', () => {
  test('accepts a self-hosted configuration without social providers', () => {
    expect(parseCloudServerConfig(baseConfig)).toMatchObject({
      deployment: 'self-hosted',
      indexingPolicy: 'deny',
      trustedOrigins: []
    })
  })

  test('requires an MFA method when enforcing deployment administrator MFA', () => {
    expect(() =>
      parseCloudServerConfig({ ...baseConfig, deploymentAdminMFARequired: true })
    ).toThrow('requires TOTP or passkeys')
  })

  test('requires administrator MFA on an official deployment', () => {
    for (const config of [
      { deployment: 'official' },
      { deployment: 'official', totpEnabled: true }
    ]) {
      expect(() => parseCloudServerConfig({ ...baseConfig, ...config })).toThrow(
        'requires MFA for deployment administrators'
      )
    }
    expect(parseCloudServerConfig({ ...baseConfig, ...officialMFA }).deployment).toBe('official')
  })

  test('requires email delivery when enabling email and password', () => {
    expect(() => parseCloudServerConfig({ ...baseConfig, emailPasswordEnabled: true })).toThrow(
      'requires transactional email delivery'
    )
  })

  test('requires strong abuse controls for official public credential sign-up', () => {
    expect(() =>
      parseCloudServerConfig({
        ...baseConfig,
        ...officialMFA,
        emailPasswordEnabled: true,
        emailTransport: 'cloudflare',
        emailFrom: 'cloud@example.com'
      })
    ).toThrow('requires compromised-password checks and CAPTCHA')
  })

  test('requires CAPTCHA public and secret configuration together', () => {
    expect(() =>
      parseCloudServerConfig({
        ...baseConfig,
        captchaProvider: 'cloudflare-turnstile',
        captchaSiteKey: 'public-site-key'
      })
    ).toThrow('CAPTCHA configuration must provide')
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

  test('requires HTTPS for the services endpoint on any deployment, whatever the scheme case', () => {
    const configured = { ...baseConfig, servicesSigningKey: 'signing-key-pem' }
    for (const config of [configured, { ...configured, ...officialMFA }]) {
      for (const servicesEndpoint of ['http://ai.example.com', 'HTTP://ai.example.com']) {
        expect(() => parseCloudServerConfig({ ...config, servicesEndpoint })).toThrow(
          'The services endpoint must use HTTPS'
        )
      }
      expect(
        parseCloudServerConfig({ ...config, servicesEndpoint: 'HTTPS://ai.example.com' })
          .servicesEndpoint
      ).toBe('HTTPS://ai.example.com')
    }
    // A service running beside the server, for development, is reached in the clear, but only
    // at a loopback address: a name is whatever the resolver answers.
    expect(() =>
      parseCloudServerConfig({ ...configured, servicesEndpoint: 'http://localhost:8787' })
    ).toThrow('The services endpoint must use HTTPS')
    for (const servicesEndpoint of ['http://127.0.0.1:8787', 'http://[::1]:8787']) {
      expect(parseCloudServerConfig({ ...configured, servicesEndpoint }).servicesEndpoint).toBe(
        servicesEndpoint
      )
    }
  })

  test('requires HTTPS for the billing endpoint, which editors send a token', () => {
    const configured = {
      ...baseConfig,
      servicesSigningKey: 'signing-key-pem',
      servicesEndpoint: 'https://ai.example.com',
      internalServiceToken: 'service-token-with-at-least-32-characters'
    }
    for (const config of [configured, { ...configured, ...officialMFA }]) {
      for (const billingEndpoint of ['http://billing.example.com', 'HTTP://billing.example.com']) {
        expect(() => parseCloudServerConfig({ ...config, billingEndpoint })).toThrow(
          'The billing endpoint must use HTTPS'
        )
      }
      expect(
        parseCloudServerConfig({ ...config, billingEndpoint: 'https://billing.example.com' })
          .billingEndpoint
      ).toBe('https://billing.example.com')
    }
  })

  test('rejects short auth secrets', () => {
    expect(() => parseCloudServerConfig({ ...baseConfig, authSecret: 'short' })).toThrow()
  })
})
