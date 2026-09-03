import { staticEntitlementsTOMLSchema } from '#cloud/server/policy/static'
import { parse as parseTOML } from 'smol-toml'
import * as v from 'valibot'

import type { CloudEnvironment } from './environment'
import { parseCloudServerConfig, type CloudServerConfig } from './schema'

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
  turnstileSecretKey: 'TURNSTILE_SECRET_KEY'
} as const

const url = v.pipe(v.string(), v.url())
const text = v.pipe(v.string(), v.trim(), v.minLength(1))
const positiveInteger = v.pipe(v.number(), v.integer(), v.minValue(1))
const secretReferenceSchema = v.object({ from_env: text })
const configurableTextSchema = v.union([text, secretReferenceSchema])
const defaultReference = (name: string) => v.optional(secretReferenceSchema, { from_env: name })

const providerSchema = v.object({
  google: v.optional(
    v.object({
      client_id: v.optional(configurableTextSchema, {
        from_env: DEFAULT_SECRET_NAMES.googleClientId
      }),
      client_secret: defaultReference(DEFAULT_SECRET_NAMES.googleClientSecret)
    })
  ),
  apple: v.optional(
    v.object({
      client_id: text,
      team_id: text,
      key_id: text,
      private_key: defaultReference(DEFAULT_SECRET_NAMES.applePrivateKey),
      app_bundle_identifier: v.optional(text)
    })
  )
})

const emailSchema = v.optional(
  v.variant('transport', [
    v.object({ transport: v.literal('none') }),
    v.object({
      transport: v.literal('smtp'),
      from: text,
      smtp: v.object({
        host: text,
        port: positiveInteger,
        secure: v.optional(v.boolean()),
        user: v.optional(secretReferenceSchema, {
          from_env: DEFAULT_SECRET_NAMES.smtpUser
        }),
        password: v.optional(secretReferenceSchema, {
          from_env: DEFAULT_SECRET_NAMES.smtpPassword
        })
      })
    }),
    v.object({ transport: v.literal('cloudflare'), from: text })
  ]),
  { transport: 'none' }
)

export const cloudDeploymentConfigSchema = v.object({
  schema_version: v.literal(2),
  deployment: v.object({
    mode: v.picklist(['official', 'self-hosted']),
    public_url: url,
    app_url: v.optional(url),
    indexing: v.optional(v.picklist(['allow', 'deny']), 'deny'),
    trusted_origins: v.optional(v.array(url), [])
  }),
  database: v.optional(v.object({ url: defaultReference(DEFAULT_SECRET_NAMES.databaseURL) }), {
    url: { from_env: DEFAULT_SECRET_NAMES.databaseURL }
  }),
  authentication: v.object({
    secret: defaultReference(DEFAULT_SECRET_NAMES.authSecret),
    enrollment_mode: v.optional(v.picklist(['open', 'approval', 'closed']), 'open'),
    admin_notification_emails: v.optional(v.array(v.pipe(v.string(), v.email())), []),
    admin_user_ids: v.optional(v.array(text), []),
    email_password: v.optional(
      v.object({
        enabled: v.optional(v.boolean(), false),
        sign_up: v.optional(v.boolean(), true),
        minimum_password_length: v.optional(
          v.pipe(v.number(), v.integer(), v.minValue(8), v.maxValue(128)),
          15
        ),
        maximum_password_length: v.optional(
          v.pipe(v.number(), v.integer(), v.minValue(15), v.maxValue(128)),
          128
        ),
        verification_link_expires_minutes: v.optional(positiveInteger, 60),
        password_reset_link_expires_minutes: v.optional(positiveInteger, 60),
        compromised_password_check: v.optional(v.boolean(), false)
      }),
      {
        enabled: false,
        sign_up: true,
        minimum_password_length: 15,
        maximum_password_length: 128,
        verification_link_expires_minutes: 60,
        password_reset_link_expires_minutes: 60,
        compromised_password_check: false
      }
    ),
    captcha: v.optional(
      v.object({
        provider: v.literal('cloudflare-turnstile'),
        site_key: text,
        secret_key: defaultReference(DEFAULT_SECRET_NAMES.turnstileSecretKey),
        allowed_hostnames: v.optional(v.array(text), [])
      })
    ),
    trusted_proxies: v.optional(
      v.object({
        headers: v.optional(v.array(text), []),
        addresses: v.optional(v.array(text), [])
      }),
      { headers: [], addresses: [] }
    ),
    providers: v.optional(providerSchema, {})
  }),
  object_storage: v.object({
    endpoint: url,
    region: text,
    bucket: text,
    credentials: v.optional(
      v.object({
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
    kms_key_id: v.optional(text)
  }),
  collaboration: v.optional(
    v.object({ public_url: v.pipe(v.string(), v.url()), port: v.optional(positiveInteger, 1234) })
  ),
  email: emailSchema,
  workers: v.optional(
    v.object({
      email: v.optional(
        v.object({
          batch_size: v.optional(positiveInteger, 50),
          interval_ms: v.optional(positiveInteger, 30_000),
          lease_ms: v.optional(positiveInteger, 300_000),
          maximum_attempts: v.optional(positiveInteger, 5)
        }),
        { batch_size: 50, interval_ms: 30_000, lease_ms: 300_000, maximum_attempts: 5 }
      ),
      cleanup: v.optional(
        v.object({
          enabled: v.optional(v.boolean(), true),
          batch_size: v.optional(positiveInteger, 100),
          interval_ms: v.optional(positiveInteger, 60_000),
          lease_ms: v.optional(positiveInteger, 300_000),
          document_retention_days: v.optional(v.pipe(v.number(), v.minValue(0)), 30)
        }),
        {
          enabled: true,
          batch_size: 100,
          interval_ms: 60_000,
          lease_ms: 300_000,
          document_retention_days: 30
        }
      )
    })
  ),
  entitlements: v.optional(
    v.variant('source', [
      v.object({ source: v.literal('static'), ...staticEntitlementsTOMLSchema.entries }),
      v.object({ source: v.literal('database') })
    ])
  ),
  technical_limits: v.optional(
    v.object({
      maximum_upload_bytes: v.optional(positiveInteger),
      maximum_collaboration_message_bytes: v.optional(positiveInteger),
      maximum_connections_per_room: v.optional(positiveInteger)
    })
  )
})

export type CloudDeploymentConfig = v.InferOutput<typeof cloudDeploymentConfigSchema>
export type CloudSecretReference = v.InferOutput<typeof secretReferenceSchema>

export function parseCloudDeploymentSource(source: string): CloudDeploymentConfig {
  return v.parse(cloudDeploymentConfigSchema, parseTOML(source))
}

function requiredSecret(environment: CloudEnvironment, reference: CloudSecretReference): string {
  const value = environment[reference.from_env]
  if (!value) throw new Error(`Required secret binding is unavailable: ${reference.from_env}`)
  return value
}

function configuredText(
  environment: CloudEnvironment,
  value: string | CloudSecretReference
): string {
  return typeof value === 'string' ? value : requiredSecret(environment, value)
}

function optionalSecret(
  environment: CloudEnvironment,
  reference?: CloudSecretReference
): string | undefined {
  return reference ? environment[reference.from_env] : undefined
}

function staticEntitlements(config: CloudDeploymentConfig) {
  if (config.entitlements?.source !== 'static') return undefined
  return {
    documents: {
      maximumFileBytes: config.entitlements.documents?.maximum_file_bytes,
      revisionHistory: config.entitlements.documents?.revision_history
    },
    storage: { maximumBytes: config.entitlements.storage?.maximum_bytes },
    sharing: {
      capabilityLinks: config.entitlements.sharing?.capability_links,
      anonymousView: config.entitlements.sharing?.anonymous_view,
      anonymousEdit: config.entitlements.sharing?.anonymous_edit,
      guestPresence: config.entitlements.sharing?.guest_presence
    },
    collaboration: {
      enabled: config.entitlements.collaboration?.enabled,
      maximumParticipants: config.entitlements.collaboration?.maximum_participants
    }
  }
}

function emailConfig(config: CloudDeploymentConfig, environment: CloudEnvironment) {
  if (config.email.transport === 'none') return { emailTransport: 'none' as const }
  if (config.email.transport === 'cloudflare') {
    return { emailTransport: 'cloudflare' as const, emailFrom: config.email.from }
  }
  return {
    emailTransport: 'smtp' as const,
    emailFrom: config.email.from,
    smtpHost: config.email.smtp.host,
    smtpPort: config.email.smtp.port,
    smtpSecure: config.email.smtp.secure,
    smtpUser: optionalSecret(environment, config.email.smtp.user),
    smtpPassword: optionalSecret(environment, config.email.smtp.password)
  }
}

function authenticationConfig(config: CloudDeploymentConfig, environment: CloudEnvironment) {
  const google = config.authentication.providers.google
  const apple = config.authentication.providers.apple
  return {
    googleClientId: google ? configuredText(environment, google.client_id) : undefined,
    googleClientSecret: google ? requiredSecret(environment, google.client_secret) : undefined,
    appleClientId: apple?.client_id,
    appleTeamId: apple?.team_id,
    appleKeyId: apple?.key_id,
    applePrivateKey: apple ? requiredSecret(environment, apple.private_key) : undefined,
    appleAppBundleIdentifier: apple?.app_bundle_identifier
  }
}

function workerConfig(config: CloudDeploymentConfig) {
  const email = config.workers?.email
  const cleanup = config.workers?.cleanup
  return {
    emailBatchSize: email?.batch_size,
    emailIntervalMs: email?.interval_ms,
    emailLeaseDurationMs: email?.lease_ms,
    emailMaximumAttempts: email?.maximum_attempts,
    cleanupEnabled: cleanup?.enabled,
    cleanupBatchSize: cleanup?.batch_size,
    cleanupIntervalMs: cleanup?.interval_ms,
    cleanupLeaseDurationMs: cleanup?.lease_ms,
    documentRetentionMs: cleanup ? cleanup.document_retention_days * 86_400_000 : undefined
  }
}

function technicalLimits(config: CloudDeploymentConfig) {
  const limits = config.technical_limits
  if (!limits) return undefined
  return {
    maximumUploadBytes: limits.maximum_upload_bytes,
    maximumCollaborationMessageBytes: limits.maximum_collaboration_message_bytes,
    maximumConnectionsPerRoom: limits.maximum_connections_per_room
  }
}

export function parseCloudDeploymentConfig(
  input: unknown,
  environment: CloudEnvironment
): CloudServerConfig {
  const config = v.parse(cloudDeploymentConfigSchema, input)
  return parseCloudServerConfig({
    deployment: config.deployment.mode,
    publicURL: config.deployment.public_url,
    appURL: config.deployment.app_url,
    indexingPolicy: config.deployment.indexing,
    trustedOrigins: config.deployment.trusted_origins,
    databaseURL: requiredSecret(environment, config.database.url),
    authSecret: requiredSecret(environment, config.authentication.secret),
    enrollmentMode: config.authentication.enrollment_mode,
    enrollmentAdminNotificationEmails: config.authentication.admin_notification_emails,
    deploymentAdminUserIds: config.authentication.admin_user_ids,
    emailPasswordEnabled: config.authentication.email_password.enabled,
    emailPasswordSignUpEnabled: config.authentication.email_password.sign_up,
    emailPasswordMinimumLength: config.authentication.email_password.minimum_password_length,
    emailPasswordMaximumLength: config.authentication.email_password.maximum_password_length,
    emailVerificationExpiresIn:
      config.authentication.email_password.verification_link_expires_minutes * 60,
    passwordResetExpiresIn:
      config.authentication.email_password.password_reset_link_expires_minutes * 60,
    compromisedPasswordCheck: config.authentication.email_password.compromised_password_check,
    captchaProvider: config.authentication.captcha?.provider,
    captchaSiteKey: config.authentication.captcha?.site_key,
    captchaSecretKey: config.authentication.captcha
      ? requiredSecret(environment, config.authentication.captcha.secret_key)
      : undefined,
    captchaAllowedHostnames: config.authentication.captcha?.allowed_hostnames,
    authTrustedIPHeaders: config.authentication.trusted_proxies.headers,
    authTrustedProxies: config.authentication.trusted_proxies.addresses,
    ...authenticationConfig(config, environment),
    s3Endpoint: config.object_storage.endpoint,
    s3Region: config.object_storage.region,
    s3Bucket: config.object_storage.bucket,
    s3AccessKeyId: requiredSecret(environment, config.object_storage.credentials.access_key_id),
    s3SecretAccessKey: requiredSecret(
      environment,
      config.object_storage.credentials.secret_access_key
    ),
    s3SessionToken: environment[config.object_storage.credentials.session_token.from_env],
    s3ForcePathStyle: config.object_storage.force_path_style,
    s3ChecksumVerification: config.object_storage.checksum_verification,
    s3ServerSideEncryption: config.object_storage.server_side_encryption,
    s3KmsKeyId: config.object_storage.kms_key_id,
    collaborationURL: config.collaboration?.public_url,
    collaborationPort: config.collaboration?.port,
    staticEntitlements: staticEntitlements(config),
    ...emailConfig(config, environment),
    ...workerConfig(config),
    technicalLimits: technicalLimits(config)
  })
}

export function parseCloudDeploymentTOML(
  source: string,
  environment: CloudEnvironment
): CloudServerConfig {
  return parseCloudDeploymentConfig(parseCloudDeploymentSource(source), environment)
}
