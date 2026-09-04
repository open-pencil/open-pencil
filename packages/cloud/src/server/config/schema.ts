import { CLOUD_PROTOCOL_MAX_UPLOAD_BYTES } from '#cloud/contract'
import { staticEntitlementsSchema } from '#cloud/server/policy/static'
import * as v from 'valibot'

import {
  CLOUD_DEFAULT_MAX_COLLABORATION_MESSAGE_BYTES,
  CLOUD_DEFAULT_MAX_CONNECTIONS_PER_ROOM
} from './limits'

const httpURLSchema = v.pipe(
  v.string(),
  v.url(),
  v.check((value) => {
    const protocol = new URL(value).protocol
    return protocol === 'https:' || protocol === 'http:'
  }, 'URL must use HTTP or HTTPS')
)

const websocketURLSchema = v.pipe(
  v.string(),
  v.url(),
  v.check((value) => {
    const protocol = new URL(value).protocol
    return protocol === 'ws:' || protocol === 'wss:'
  }, 'URL must use WS or WSS')
)

const optionalTextSchema = v.optional(v.pipe(v.string(), v.trim(), v.minLength(1)))

const rawCloudServerConfigSchema = v.object({
  deployment: v.picklist(['official', 'self-hosted']),
  publicURL: httpURLSchema,
  appURL: v.optional(httpURLSchema),
  collaborationURL: v.optional(websocketURLSchema),
  collaborationPort: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65_535)),
    1234
  ),
  technicalLimits: v.optional(
    v.object({
      maximumUploadBytes: v.optional(
        v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(CLOUD_PROTOCOL_MAX_UPLOAD_BYTES)),
        CLOUD_PROTOCOL_MAX_UPLOAD_BYTES
      ),
      maximumCollaborationMessageBytes: v.optional(
        v.pipe(v.number(), v.integer(), v.minValue(1024)),
        CLOUD_DEFAULT_MAX_COLLABORATION_MESSAGE_BYTES
      ),
      maximumConnectionsPerRoom: v.optional(
        v.pipe(v.number(), v.integer(), v.minValue(1)),
        CLOUD_DEFAULT_MAX_CONNECTIONS_PER_ROOM
      )
    }),
    {
      maximumUploadBytes: CLOUD_PROTOCOL_MAX_UPLOAD_BYTES,
      maximumCollaborationMessageBytes: CLOUD_DEFAULT_MAX_COLLABORATION_MESSAGE_BYTES,
      maximumConnectionsPerRoom: CLOUD_DEFAULT_MAX_CONNECTIONS_PER_ROOM
    }
  ),
  staticEntitlements: v.optional(staticEntitlementsSchema),
  databaseURL: v.pipe(v.string(), v.url()),
  authSecret: v.pipe(v.string(), v.minLength(32)),
  trustedOrigins: v.optional(v.array(httpURLSchema), []),
  authTrustedIPHeaders: v.optional(v.array(v.pipe(v.string(), v.trim(), v.minLength(1))), []),
  authTrustedProxies: v.optional(v.array(v.pipe(v.string(), v.trim(), v.minLength(1))), []),
  enrollmentMode: v.optional(v.picklist(['open', 'approval', 'closed']), 'open'),
  indexingPolicy: v.optional(v.picklist(['allow', 'deny']), 'deny'),
  enrollmentAdminNotificationEmails: v.optional(
    v.array(v.pipe(v.string(), v.trim(), v.email())),
    []
  ),
  deploymentAdminUserIds: v.optional(v.array(v.pipe(v.string(), v.trim(), v.minLength(1))), []),
  emailPasswordEnabled: v.optional(v.boolean(), false),
  emailPasswordSignUpEnabled: v.optional(v.boolean(), true),
  emailPasswordMinimumLength: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(8), v.maxValue(128)),
    15
  ),
  emailPasswordMaximumLength: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(15), v.maxValue(128)),
    128
  ),
  emailVerificationExpiresIn: v.optional(v.pipe(v.number(), v.integer(), v.minValue(60)), 3600),
  passwordResetExpiresIn: v.optional(v.pipe(v.number(), v.integer(), v.minValue(60)), 3600),
  compromisedPasswordCheck: v.optional(v.boolean(), false),
  deploymentAdminMFARequired: v.optional(v.boolean(), false),
  totpEnabled: v.optional(v.boolean(), false),
  passkeysEnabled: v.optional(v.boolean(), false),
  recoveryCodesEnabled: v.optional(v.boolean(), false),
  mfaTrustedDeviceDays: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 14),
  passkeyRPID: optionalTextSchema,
  passkeyRPName: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1)), 'OpenPencil Cloud'),
  passkeyOrigin: v.optional(httpURLSchema),
  captchaProvider: v.optional(v.literal('cloudflare-turnstile')),
  captchaSiteKey: optionalTextSchema,
  captchaSecretKey: optionalTextSchema,
  captchaAllowedHostnames: v.optional(v.array(v.pipe(v.string(), v.trim(), v.minLength(1))), []),
  googleClientId: optionalTextSchema,
  googleClientSecret: optionalTextSchema,
  appleClientId: optionalTextSchema,
  appleTeamId: optionalTextSchema,
  appleKeyId: optionalTextSchema,
  applePrivateKey: optionalTextSchema,
  appleAppBundleIdentifier: optionalTextSchema,
  s3Endpoint: httpURLSchema,
  s3Region: v.pipe(v.string(), v.trim(), v.minLength(1)),
  s3Bucket: v.pipe(v.string(), v.trim(), v.minLength(1)),
  s3AccessKeyId: v.pipe(v.string(), v.trim(), v.minLength(1)),
  s3SecretAccessKey: v.pipe(v.string(), v.minLength(1)),
  s3SessionToken: optionalTextSchema,
  s3ForcePathStyle: v.optional(v.boolean(), true),
  s3ChecksumVerification: v.optional(v.picklist(['native', 'metadata']), 'native'),
  s3ServerSideEncryption: v.optional(v.picklist(['AES256', 'aws:kms'])),
  s3KmsKeyId: optionalTextSchema,
  smtpHost: optionalTextSchema,
  smtpPort: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65_535))),
  smtpSecure: v.optional(v.boolean()),
  smtpUser: optionalTextSchema,
  smtpPassword: optionalTextSchema,
  emailFrom: optionalTextSchema,
  emailTransport: v.optional(v.picklist(['none', 'smtp', 'cloudflare']), 'none'),
  emailBatchSize: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1000)), 50),
  emailIntervalMs: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1000)), 30_000),
  emailLeaseDurationMs: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1000)), 5 * 60_000),
  emailMaximumAttempts: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20)),
    5
  ),
  cleanupEnabled: v.optional(v.boolean(), true),
  cleanupBatchSize: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1000)),
    100
  ),
  cleanupIntervalMs: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1000)), 60_000),
  cleanupLeaseDurationMs: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1000)), 5 * 60_000),
  documentRetentionMs: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(0)),
    30 * 24 * 60 * 60_000
  )
})

export type CloudServerConfig = v.InferOutput<typeof rawCloudServerConfigSchema>

export class CloudConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CloudConfigError'
  }
}

function requireTogether(
  config: CloudServerConfig,
  label: string,
  fields: Array<keyof CloudServerConfig>
): void {
  const configured = fields.filter((field) => Boolean(config[field]))
  if (configured.length !== 0 && configured.length !== fields.length) {
    throw new CloudConfigError(`${label} configuration must provide ${fields.join(', ')}`)
  }
}

function validateAuthenticationConfig(config: CloudServerConfig): void {
  if (config.emailPasswordMinimumLength > config.emailPasswordMaximumLength) {
    throw new CloudConfigError('Minimum password length cannot exceed maximum password length')
  }
  if (config.emailPasswordEnabled && config.emailTransport === 'none') {
    throw new CloudConfigError(
      'Email and password authentication requires transactional email delivery'
    )
  }
  if (config.deploymentAdminMFARequired && !config.totpEnabled && !config.passkeysEnabled) {
    throw new CloudConfigError('Deployment administrator MFA requires TOTP or passkeys')
  }
  if (config.recoveryCodesEnabled && !config.totpEnabled) {
    throw new CloudConfigError('MFA recovery codes require TOTP')
  }
  if (config.passkeysEnabled) {
    const publicURL = new URL(config.publicURL)
    if (config.passkeyOrigin && new URL(config.passkeyOrigin).origin !== publicURL.origin) {
      throw new CloudConfigError('Passkey origin must match the Cloud public URL origin')
    }
    if (config.passkeyRPID && config.passkeyRPID !== publicURL.hostname) {
      throw new CloudConfigError('Passkey RP ID must match the Cloud public URL hostname')
    }
  }
  requireTogether(config, 'CAPTCHA', ['captchaProvider', 'captchaSiteKey', 'captchaSecretKey'])
  if (
    config.deployment === 'official' &&
    config.emailPasswordEnabled &&
    config.emailPasswordSignUpEnabled &&
    (!config.compromisedPasswordCheck || !config.captchaProvider)
  ) {
    throw new CloudConfigError(
      'Official email and password sign-up requires compromised-password checks and CAPTCHA'
    )
  }
  requireTogether(config, 'Google', ['googleClientId', 'googleClientSecret'])
  requireTogether(config, 'Apple', [
    'appleClientId',
    'appleTeamId',
    'appleKeyId',
    'applePrivateKey'
  ])
}

function validateEmailConfig(config: CloudServerConfig): void {
  requireTogether(config, 'SMTP', ['smtpHost', 'smtpPort'])
  requireTogether(config, 'SMTP authentication', ['smtpUser', 'smtpPassword'])
  if (config.emailTransport === 'smtp' && !config.smtpHost) {
    throw new CloudConfigError('SMTP email transport requires SMTP configuration')
  }
  if (config.smtpHost && config.emailTransport !== 'smtp') {
    throw new CloudConfigError('SMTP configuration requires the smtp email transport')
  }
  if (config.emailTransport !== 'none' && !config.emailFrom) {
    throw new CloudConfigError('Transactional email delivery requires an email from address')
  }
  if (config.deployment === 'official' && config.smtpHost && config.smtpSecure === false) {
    throw new CloudConfigError('Official SMTP delivery must use a secure connection')
  }
}

function validateObjectStorageConfig(config: CloudServerConfig): void {
  if (config.s3KmsKeyId && config.s3ServerSideEncryption !== 'aws:kms') {
    throw new CloudConfigError('S3 KMS key ID requires aws:kms server-side encryption')
  }
  const endpointHost = new URL(config.s3Endpoint).hostname
  if (!endpointHost.endsWith('.r2.cloudflarestorage.com')) return
  if (config.s3Region !== 'auto') {
    throw new CloudConfigError('Cloudflare R2 S3 region must be auto')
  }
  if (config.s3ForcePathStyle) {
    throw new CloudConfigError('Cloudflare R2 S3 endpoint must disable path-style requests')
  }
  if (config.s3ChecksumVerification !== 'metadata') {
    throw new CloudConfigError('Cloudflare R2 checksum verification must use metadata')
  }
}

export function parseCloudServerConfig(input: unknown): CloudServerConfig {
  const config = v.parse(rawCloudServerConfigSchema, input)
  if (
    config.appURL &&
    !config.trustedOrigins.some(
      (origin) => new URL(origin).origin === new URL(config.appURL ?? '').origin
    )
  ) {
    throw new CloudConfigError('Cloud app URL must be included in trusted origins')
  }
  validateAuthenticationConfig(config)
  validateEmailConfig(config)
  validateObjectStorageConfig(config)
  return config
}
