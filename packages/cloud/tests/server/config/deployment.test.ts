import { describe, expect, test } from 'bun:test'

import {
  cloudDeploymentConfigSchema,
  cloudDiscoveryFromConfig,
  parseCloudDeploymentConfig,
  parseCloudDeploymentTOML
} from '#cloud/server'
import { parse as parseTOML } from 'smol-toml'
import * as v from 'valibot'

const minimalSource = `
schema_version = 2

[deployment]
mode = "self-hosted"
public_url = "https://cloud.example.com"
trusted_origins = ["https://app.example.com"]

[authentication.enrollment]
mode = "approval"
notification_emails = ["admin@example.com"]

[authentication.mfa]
required_for_admins = true
totp = true
recovery_codes = true
trusted_device_lifetime_days = 7

[authentication.passkeys]
enabled = true
rp_name = "Example Cloud"

[authentication.email_password]
enabled = true
sign_up = false
minimum_password_length = 16
maximum_password_length = 120
verification_link_lifetime_minutes = 30
password_reset_link_lifetime_minutes = 45
compromised_password_check = true

[authentication.captcha]
provider = "cloudflare-turnstile"
site_key = "public-turnstile-site-key"
allowed_hostnames = ["cloud.example.com"]

[authentication.providers.google]

[email]
transport = "smtp"
from = "cloud@example.com"

[email.smtp]
host = "smtp.example.com"
port = 465
secure = true

[object_storage]
endpoint = "https://objects.example.com"
region = "us-east-1"
bucket = "openpencil"
`

const environment = {
  DATABASE_URL: 'postgresql://user:password@database/openpencil',
  BETTER_AUTH_SECRET: 'auth-secret-at-least-32-characters-long',
  TURNSTILE_SECRET_KEY: 'turnstile-secret',
  GOOGLE_CLIENT_ID: 'google-public-client-id',
  GOOGLE_CLIENT_SECRET: 'google-secret',
  OPENPENCIL_CLOUD_SMTP_USER: 'smtp-user',
  OPENPENCIL_CLOUD_SMTP_PASSWORD: 'smtp-password',
  S3_ACCESS_KEY_ID: 'access-key',
  S3_SECRET_ACCESS_KEY: 'secret-key'
}

const completeSource = `${minimalSource.replace(
  'trusted_origins = ["https://app.example.com"]',
  'trusted_origins = ["https://app.example.com"]\nindexing = "allow"\nlocal_editor = false'
)}
maximum_upload_bytes = 104857600

[collaboration]
maximum_message_bytes = 524288
maximum_connections_per_room = 250

[documents]
retention_days = 14

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
`

describe('Cloud TOML deployment configuration', () => {
  test('uses conventional secret references without TOML boilerplate', () => {
    expect(parseCloudDeploymentTOML(minimalSource, environment)).toMatchObject({
      deployment: 'self-hosted',
      databaseURL: environment.DATABASE_URL,
      authSecret: environment.BETTER_AUTH_SECRET,
      enrollmentMode: 'approval',
      enrollmentAdminNotificationEmails: ['admin@example.com'],
      localEditor: true,
      emailPasswordEnabled: true,
      emailPasswordSignUpEnabled: false,
      emailPasswordMinimumLength: 16,
      emailPasswordMaximumLength: 120,
      emailVerificationExpiresIn: 1800,
      passwordResetExpiresIn: 2700,
      compromisedPasswordCheck: true,
      deploymentAdminMFARequired: true,
      totpEnabled: true,
      passkeysEnabled: true,
      recoveryCodesEnabled: true,
      mfaTrustedDeviceDays: 7,
      passkeyRPName: 'Example Cloud',
      captchaProvider: 'cloudflare-turnstile',
      captchaSiteKey: 'public-turnstile-site-key',
      captchaSecretKey: 'turnstile-secret',
      captchaAllowedHostnames: ['cloud.example.com'],
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
      localEditor: false,
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

  test('lists the server for editors from a minimum version, and only when configured', () => {
    const unlisted = cloudDiscoveryFromConfig(parseCloudDeploymentTOML(minimalSource, environment))
    expect(unlisted.listing).toBeUndefined()

    const listedSource = minimalSource.replace(
      'trusted_origins = ["https://app.example.com"]',
      'trusted_origins = ["https://app.example.com"]\nlisting = { minimum_editor_version = "0.14.0" }'
    )
    const listed = cloudDiscoveryFromConfig(parseCloudDeploymentTOML(listedSource, environment))
    expect(listed.listing).toEqual({ minimumEditorVersion: '0.14.0' })

    expect(() =>
      parseCloudDeploymentTOML(listedSource.replace('"0.14.0"', '"soon"'), environment)
    ).toThrow()
  })

  test('advertises an AI service and billing portal only when configured', () => {
    const plain = cloudDiscoveryFromConfig(parseCloudDeploymentTOML(minimalSource, environment))
    expect(plain.ai).toBeUndefined()
    expect(plain.billing).toBeUndefined()

    const source = `${minimalSource}
[ai]
endpoint = "https://ai.example.com"
token_lifetime_minutes = 5

[billing]
portal_url = "https://billing.example.com"

[internal_api]
`
    const withSecrets = {
      ...environment,
      OPENPENCIL_CLOUD_AI_SIGNING_KEY: 'signing-key-pem',
      OPENPENCIL_CLOUD_SERVICE_TOKEN: 'service-token-with-at-least-32-characters'
    }
    const config = parseCloudDeploymentTOML(source, withSecrets)
    expect(config).toMatchObject({
      aiEndpoint: 'https://ai.example.com',
      aiSigningKey: 'signing-key-pem',
      aiTokenLifetimeSeconds: 300,
      billingPortalURL: 'https://billing.example.com',
      internalServiceToken: 'service-token-with-at-least-32-characters'
    })
    const discovery = cloudDiscoveryFromConfig(config)
    expect(discovery.ai).toEqual({ endpoint: 'https://ai.example.com', contractVersion: '1' })
    expect(discovery.billing).toEqual({ portalURL: 'https://billing.example.com' })

    expect(() => parseCloudDeploymentTOML(source, environment)).toThrow(
      'OPENPENCIL_CLOUD_AI_SIGNING_KEY'
    )
    expect(() =>
      parseCloudDeploymentTOML(`${source}\n[entitlements]\nsource = "static"\n`, withSecrets)
    ).toThrow('static entitlements')
  })

  test('reads a relay URL override and requires a WebSocket scheme', () => {
    const relay = (url: string) =>
      parseCloudDeploymentTOML(
        `${minimalSource}\n[collaboration]\nrelay_url = "${url}"\n`,
        environment
      )
    expect(relay('wss://relay.example.com/api/collaboration/relay').relayURL).toBe(
      'wss://relay.example.com/api/collaboration/relay'
    )
    expect(() => relay('https://relay.example.com')).toThrow()
    expect(parseCloudDeploymentTOML(minimalSource, environment).relayURL).toBeUndefined()
  })

  test('refuses keys it does not know rather than leaving their settings at defaults', () => {
    const renamed = minimalSource.replace(
      '[authentication.enrollment]\nmode = "approval"',
      '[authentication]\nenrollment_mode = "approval"\n\n[authentication.enrollment]'
    )
    expect(renamed).not.toBe(minimalSource)
    expect(() => parseCloudDeploymentTOML(renamed, environment)).toThrow()
    expect(() =>
      parseCloudDeploymentTOML(`${minimalSource}\n[technical_limits]\n`, environment)
    ).toThrow()
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
