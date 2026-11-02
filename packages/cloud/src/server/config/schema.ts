import {
  CLOUD_PROTOCOL_MAX_UPLOAD_BYTES,
  cloudEditorVersionSchema,
  RELAY_MINIMUM_MESSAGE_BYTES
} from '#cloud/contract'
import { staticEntitlementsSchema, staticEntitlementsTOMLSchema } from '#cloud/server/policy/schema'
import * as v from 'valibot'

import {
  CLOUD_DEFAULT_MAX_COLLABORATION_MESSAGE_BYTES,
  CLOUD_DEFAULT_MAX_CONNECTIONS_PER_ROOM
} from './limits'

export const httpURLSchema = v.pipe(
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
  listingMinimumEditorVersion: v.optional(cloudEditorVersionSchema),
  relayURL: v.optional(websocketURLSchema),
  technicalLimits: v.optional(
    v.object({
      maximumUploadBytes: v.optional(
        v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(CLOUD_PROTOCOL_MAX_UPLOAD_BYTES)),
        CLOUD_PROTOCOL_MAX_UPLOAD_BYTES
      ),
      maximumCollaborationMessageBytes: v.optional(
        v.pipe(v.number(), v.integer(), v.minValue(RELAY_MINIMUM_MESSAGE_BYTES)),
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
  /** The server's editor works with files on this device without signing in to the server. */
  localEditor: v.optional(v.boolean(), true),
  authTrustedIPHeaders: v.optional(v.array(v.pipe(v.string(), v.trim(), v.minLength(1))), []),
  authTrustedProxies: v.optional(v.array(v.pipe(v.string(), v.trim(), v.minLength(1))), []),
  enrollmentMode: v.optional(v.picklist(['open', 'approval', 'closed']), 'open'),
  indexingPolicy: v.optional(v.picklist(['allow', 'deny']), 'deny'),
  enrollmentAdminNotificationEmails: v.optional(
    v.array(v.pipe(v.string(), v.trim(), v.email())),
    []
  ),
  emailPasswordEnabled: v.optional(v.boolean(), false),
  emailPasswordSignUpEnabled: v.optional(v.boolean(), true),
  emailPasswordMinimumLength: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(8), v.maxValue(128)),
    8
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
  passkeyRPName: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1)), 'OpenPencil Cloud'),
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
  ),
  /** The AI service editors reach with tokens this server signs; see `src/contract/ai.ts`. */
  aiEndpoint: v.optional(httpURLSchema),
  /** The PKCS #8 PEM of the P-256 key that signs AI service tokens. */
  aiSigningKey: optionalTextSchema,
  aiTokenLifetimeSeconds: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(60), v.maxValue(60 * 60)),
    10 * 60
  ),
  billingPortalURL: v.optional(httpURLSchema),
  /** The bearer token services such as billing present to the internal API. */
  internalServiceToken: v.optional(v.pipe(v.string(), v.minLength(32)))
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

function validateServiceConfig(config: CloudServerConfig): void {
  requireTogether(config, 'AI service', ['aiEndpoint', 'aiSigningKey'])
  if (config.internalServiceToken && config.staticEntitlements) {
    throw new CloudConfigError(
      'The internal API writes database entitlements, which static entitlements would hide'
    )
  }
  if (
    config.deployment === 'official' &&
    config.aiEndpoint &&
    new URL(config.aiEndpoint).protocol !== 'https:'
  ) {
    throw new CloudConfigError('Official AI service endpoint must use HTTPS')
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
  validateAuthenticationConfig(config)
  validateEmailConfig(config)
  validateServiceConfig(config)
  validateObjectStorageConfig(config)
  return config
}

const DEFAULT_SECRET_NAMES = {
  databaseURL: 'DATABASE_URL',
  authSecret: 'BETTER_AUTH_SECRET',
  googleClientId: 'GOOGLE_CLIENT_ID',
  googleClientSecret: 'GOOGLE_CLIENT_SECRET',
  applePrivateKey: 'APPLE_PRIVATE_KEY',
  s3AccessKeyId: 'S3_ACCESS_KEY_ID',
  s3SecretAccessKey: 'S3_SECRET_ACCESS_KEY',
  s3SessionToken: 'S3_SESSION_TOKEN',
  smtpUser: 'OPENPENCIL_CLOUD_SMTP_USER',
  smtpPassword: 'OPENPENCIL_CLOUD_SMTP_PASSWORD',
  turnstileSecretKey: 'TURNSTILE_SECRET_KEY',
  aiSigningKey: 'OPENPENCIL_CLOUD_AI_SIGNING_KEY',
  internalServiceToken: 'OPENPENCIL_CLOUD_SERVICE_TOKEN'
} as const

const urlSchema = v.pipe(v.string(), v.url())
const textSchema = v.pipe(v.string(), v.trim(), v.minLength(1))
const positiveIntegerSchema = v.pipe(v.number(), v.integer(), v.minValue(1))
const secretReferenceSchema = v.strictObject({ from_env: textSchema })
const configurableTextSchema = v.union([textSchema, secretReferenceSchema])
const defaultReference = (name: string) => v.optional(secretReferenceSchema, { from_env: name })

const providerSchema = v.strictObject({
  google: v.optional(
    v.strictObject({
      client_id: v.optional(configurableTextSchema, {
        from_env: DEFAULT_SECRET_NAMES.googleClientId
      }),
      client_secret: defaultReference(DEFAULT_SECRET_NAMES.googleClientSecret)
    })
  ),
  apple: v.optional(
    v.strictObject({
      client_id: textSchema,
      team_id: textSchema,
      key_id: textSchema,
      private_key: defaultReference(DEFAULT_SECRET_NAMES.applePrivateKey),
      app_bundle_identifier: v.optional(textSchema)
    })
  )
})

const emailSchema = v.optional(
  v.variant('transport', [
    v.strictObject({ transport: v.literal('none') }),
    v.strictObject({
      transport: v.literal('smtp'),
      from: textSchema,
      smtp: v.strictObject({
        host: textSchema,
        port: positiveIntegerSchema,
        secure: v.optional(v.boolean()),
        user: v.optional(secretReferenceSchema, {
          from_env: DEFAULT_SECRET_NAMES.smtpUser
        }),
        password: v.optional(secretReferenceSchema, {
          from_env: DEFAULT_SECRET_NAMES.smtpPassword
        })
      })
    }),
    v.strictObject({ transport: v.literal('cloudflare'), from: textSchema })
  ]),
  { transport: 'none' }
)

/**
 * Every table is strict: a key the schema doesn't know, such as one renamed since, stops startup
 * instead of leaving its setting at a default the operator never chose.
 */
export const cloudDeploymentConfigSchema = v.strictObject({
  schema_version: v.literal(2),
  deployment: v.strictObject({
    mode: v.picklist(['official', 'self-hosted']),
    public_url: urlSchema,
    indexing: v.optional(v.picklist(['allow', 'deny']), 'deny'),
    trusted_origins: v.optional(v.array(urlSchema), []),
    // The server's editor works with files on this device without signing in to the server.
    local_editor: v.optional(v.boolean(), true),
    listing: v.optional(v.strictObject({ minimum_editor_version: cloudEditorVersionSchema }))
  }),
  database: v.optional(
    v.strictObject({ url: defaultReference(DEFAULT_SECRET_NAMES.databaseURL) }),
    {
      url: { from_env: DEFAULT_SECRET_NAMES.databaseURL }
    }
  ),
  authentication: v.strictObject({
    secret: defaultReference(DEFAULT_SECRET_NAMES.authSecret),
    enrollment: v.optional(
      v.strictObject({
        mode: v.optional(v.picklist(['open', 'approval', 'closed']), 'open'),
        notification_emails: v.optional(v.array(v.pipe(v.string(), v.email())), [])
      }),
      { mode: 'open', notification_emails: [] }
    ),
    email_password: v.optional(
      v.strictObject({
        enabled: v.optional(v.boolean(), false),
        sign_up: v.optional(v.boolean(), true),
        minimum_password_length: v.optional(
          v.pipe(v.number(), v.integer(), v.minValue(8), v.maxValue(128)),
          8
        ),
        maximum_password_length: v.optional(
          v.pipe(v.number(), v.integer(), v.minValue(15), v.maxValue(128)),
          128
        ),
        verification_link_lifetime_minutes: v.optional(positiveIntegerSchema, 60),
        password_reset_link_lifetime_minutes: v.optional(positiveIntegerSchema, 60),
        compromised_password_check: v.optional(v.boolean(), false)
      }),
      {
        enabled: false,
        sign_up: true,
        minimum_password_length: 8,
        maximum_password_length: 128,
        verification_link_lifetime_minutes: 60,
        password_reset_link_lifetime_minutes: 60,
        compromised_password_check: false
      }
    ),
    mfa: v.optional(
      v.strictObject({
        required_for_admins: v.optional(v.boolean(), false),
        totp: v.optional(v.boolean(), false),
        recovery_codes: v.optional(v.boolean(), false),
        trusted_device_lifetime_days: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 14)
      }),
      {
        required_for_admins: false,
        totp: false,
        recovery_codes: false,
        trusted_device_lifetime_days: 14
      }
    ),
    // Passkeys belong to public_url's host and origin.
    passkeys: v.optional(
      v.strictObject({
        enabled: v.optional(v.boolean(), false),
        rp_name: v.optional(textSchema, 'OpenPencil Cloud')
      }),
      { enabled: false, rp_name: 'OpenPencil Cloud' }
    ),
    captcha: v.optional(
      v.strictObject({
        provider: v.literal('cloudflare-turnstile'),
        site_key: textSchema,
        secret_key: defaultReference(DEFAULT_SECRET_NAMES.turnstileSecretKey),
        allowed_hostnames: v.optional(v.array(textSchema), [])
      })
    ),
    trusted_proxies: v.optional(
      v.strictObject({
        headers: v.optional(v.array(textSchema), []),
        addresses: v.optional(v.array(textSchema), [])
      }),
      { headers: [], addresses: [] }
    ),
    providers: v.optional(providerSchema, {})
  }),
  object_storage: v.strictObject({
    endpoint: urlSchema,
    region: textSchema,
    bucket: textSchema,
    credentials: v.optional(
      v.strictObject({
        access_key_id: defaultReference(DEFAULT_SECRET_NAMES.s3AccessKeyId),
        secret_access_key: defaultReference(DEFAULT_SECRET_NAMES.s3SecretAccessKey),
        session_token: v.optional(secretReferenceSchema, {
          from_env: DEFAULT_SECRET_NAMES.s3SessionToken
        })
      }),
      {
        access_key_id: { from_env: DEFAULT_SECRET_NAMES.s3AccessKeyId },
        secret_access_key: { from_env: DEFAULT_SECRET_NAMES.s3SecretAccessKey }
      }
    ),
    force_path_style: v.optional(v.boolean(), true),
    checksum_verification: v.optional(v.picklist(['native', 'metadata']), 'native'),
    server_side_encryption: v.optional(v.picklist(['AES256', 'aws:kms'])),
    kms_key_id: v.optional(textSchema),
    maximum_upload_bytes: v.optional(positiveIntegerSchema)
  }),
  collaboration: v.optional(
    v.strictObject({
      relay_url: v.optional(urlSchema),
      maximum_message_bytes: v.optional(positiveIntegerSchema),
      maximum_connections_per_room: v.optional(positiveIntegerSchema)
    }),
    {}
  ),
  documents: v.optional(
    v.strictObject({
      retention_days: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 30)
    }),
    { retention_days: 30 }
  ),
  email: emailSchema,
  workers: v.optional(
    v.strictObject({
      email: v.optional(
        v.strictObject({
          batch_size: v.optional(positiveIntegerSchema, 50),
          interval_ms: v.optional(positiveIntegerSchema, 30_000),
          lease_ms: v.optional(positiveIntegerSchema, 300_000),
          maximum_attempts: v.optional(positiveIntegerSchema, 5)
        }),
        { batch_size: 50, interval_ms: 30_000, lease_ms: 300_000, maximum_attempts: 5 }
      ),
      cleanup: v.optional(
        v.strictObject({
          enabled: v.optional(v.boolean(), true),
          batch_size: v.optional(positiveIntegerSchema, 100),
          interval_ms: v.optional(positiveIntegerSchema, 60_000),
          lease_ms: v.optional(positiveIntegerSchema, 300_000)
        }),
        { enabled: true, batch_size: 100, interval_ms: 60_000, lease_ms: 300_000 }
      )
    })
  ),
  entitlements: v.optional(
    v.variant('source', [
      v.strictObject({ source: v.literal('static'), ...staticEntitlementsTOMLSchema.entries }),
      v.strictObject({ source: v.literal('database') })
    ])
  ),
  ai: v.optional(
    v.strictObject({
      endpoint: urlSchema,
      signing_key: defaultReference(DEFAULT_SECRET_NAMES.aiSigningKey),
      token_lifetime_minutes: v.optional(
        v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(60)),
        10
      )
    })
  ),
  billing: v.optional(v.strictObject({ portal_url: urlSchema })),
  internal_api: v.optional(
    v.strictObject({ service_token: defaultReference(DEFAULT_SECRET_NAMES.internalServiceToken) })
  )
})

export type CloudDeploymentConfig = v.InferOutput<typeof cloudDeploymentConfigSchema>
/** Deployment configuration as an operator writes it, before defaults are applied. */
export type CloudDeploymentInput = v.InferInput<typeof cloudDeploymentConfigSchema>
export type CloudSecretReference = v.InferOutput<typeof secretReferenceSchema>
