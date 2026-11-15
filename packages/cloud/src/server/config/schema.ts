import {
  CLOUD_PROTOCOL_MAX_UPLOAD_BYTES,
  cloudEditorVersionSchema,
  RELAY_MINIMUM_MESSAGE_BYTES,
  sendsTokenSafely
} from '#cloud/contract'
import { staticEntitlementsSchema } from '#cloud/server/policy/schema'
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

/**
 * A prefix deleted files move under: one lowercase path segment and a slash, which no object key
 * the server makes starts with (they start with `documents/`).
 */
export const deletedPrefixSchema = v.pipe(
  v.string(),
  v.regex(/^[a-z0-9][a-z0-9-]*\/$/),
  v.check((prefix) => prefix !== 'documents/', 'deleted_prefix cannot be documents/')
)

const rawCloudServerConfigSchema = v.object({
  deployment: v.picklist(['official', 'self-hosted']),
  publicURL: httpURLSchema,
  listingMinimumEditorVersion: v.optional(cloudEditorVersionSchema),
  minimumEditorVersion: v.optional(cloudEditorVersionSchema),
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
  /** With database entitlements, what an account without stored ones takes, value by value. */
  defaultEntitlements: v.optional(staticEntitlementsSchema),
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
  /** Where a deleted file is kept until the bucket's lifecycle rule expires it; see `deleted_prefix`. */
  s3DeletedPrefix: v.optional(deletedPrefixSchema),
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
  /**
   * How long a document deleted forever keeps its files and rows, out of everyone's sight, so a
   * server administrator can still bring it back; 0 destroys it at once.
   */
  documentPurgeGraceMs: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(0)),
    7 * 24 * 60 * 60_000
  ),
  /** The OpenPencil services editors reach with tokens this server signs; see `src/contract/services.ts`. */
  servicesEndpoint: v.optional(httpURLSchema),
  /** The PKCS #8 PEM of the P-256 key that signs service tokens. */
  servicesSigningKey: optionalTextSchema,
  servicesTokenLifetimeSeconds: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(60), v.maxValue(60 * 60)),
    10 * 60
  ),
  /** The billing service accounts buy plans and credits from, which discovery advertises. */
  billingEndpoint: v.optional(httpURLSchema),
  /** The bearer token services such as billing present to the internal API. */
  internalServiceToken: v.optional(v.pipe(v.string(), v.minLength(32))),
  /**
   * The operator's own terms, privacy policy, abuse contact, and minimum age; without it the
   * server shows none. With `requireAcceptance`, an account uses the server only once it accepted
   * `termsVersion`.
   */
  legal: v.optional(
    v.object({
      termsURL: v.optional(httpURLSchema),
      privacyURL: v.optional(httpURLSchema),
      termsVersion: optionalTextSchema,
      requireAcceptance: v.boolean(),
      abuseEmail: v.optional(v.pipe(v.string(), v.email())),
      minimumAge: v.optional(v.pipe(v.number(), v.integer(), v.minValue(13), v.maxValue(21)))
    })
  ),
  /**
   * The workspace whose documents anyone may open read-only, without signing in or a link: the
   * deployment's community gallery. Without it the server has none.
   */
  community: v.optional(v.object({ workspaceId: v.pipe(v.string(), v.uuid()) })),
  /** How a self-hosted server names itself on its public pages. */
  branding: v.optional(
    v.object({
      name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80))),
      logoURL: v.optional(httpURLSchema),
      helpURL: v.optional(httpURLSchema)
    })
  ),
  /** Where server errors are reported; without it the server reports nothing. */
  errorTracking: v.optional(
    v.object({
      provider: v.literal('posthog'),
      host: httpURLSchema,
      projectAPIKey: v.pipe(v.string(), v.trim(), v.minLength(1))
    })
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
  if (config.deployment === 'official' && !config.deploymentAdminMFARequired) {
    throw new CloudConfigError('An official deployment requires MFA for deployment administrators')
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
  requireTogether(config, 'Services', ['servicesEndpoint', 'servicesSigningKey'])
  // Billing tokens are signed with the services' key, and billing sets plans through the
  // internal API, which static entitlements would hide.
  if (config.billingEndpoint && !config.servicesSigningKey) {
    throw new CloudConfigError('Billing needs the services signing key to sign its tokens')
  }
  if (config.billingEndpoint && !config.internalServiceToken) {
    throw new CloudConfigError('Billing needs the internal API to set the plans it sells')
  }
  if (config.internalServiceToken && config.staticEntitlements) {
    throw new CloudConfigError(
      'The internal API writes database entitlements, which static entitlements would hide'
    )
  }
  // Editors send these endpoints a bearer token, which must not cross the network in the clear.
  for (const [name, endpoint] of [
    ['services', config.servicesEndpoint],
    ['billing', config.billingEndpoint]
  ] as const) {
    if (endpoint && !sendsTokenSafely(endpoint)) {
      throw new CloudConfigError(
        `The ${name} endpoint must use HTTPS, or HTTP only to 127.0.0.1 or [::1] for development`
      )
    }
  }
}

function validateLegalConfig(config: CloudServerConfig): void {
  const legal = config.legal
  if (legal?.requireAcceptance && !(legal.termsURL && legal.termsVersion)) {
    throw new CloudConfigError('[legal] require_acceptance needs terms_url and terms_version')
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
  validateLegalConfig(config)
  return config
}
