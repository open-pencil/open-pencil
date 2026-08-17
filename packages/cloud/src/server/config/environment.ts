import * as v from 'valibot'

import { parseCloudServerConfig, type CloudServerConfig } from './schema'

const originsEnvironmentSchema = v.optional(
  v.pipe(
    v.string(),
    v.transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    )
  )
)

const booleanEnvironmentSchema = v.optional(
  v.pipe(
    v.string(),
    v.trim(),
    v.picklist(['true', 'false']),
    v.transform((value) => value === 'true')
  )
)

const integerEnvironmentSchema = v.optional(
  v.pipe(
    v.string(),
    v.trim(),
    v.regex(/^\d+$/, 'Expected a non-negative integer'),
    v.transform(Number),
    v.safeInteger()
  )
)

export type CloudEnvironment = Readonly<Record<string, string | undefined>>

export function cloudServerConfigFromEnvironment(environment: CloudEnvironment): CloudServerConfig {
  return parseCloudServerConfig({
    deployment: environment.OPENPENCIL_CLOUD_DEPLOYMENT ?? 'self-hosted',
    publicURL: environment.OPENPENCIL_CLOUD_URL,
    appURL: environment.OPENPENCIL_CLOUD_APP_URL,
    collaborationURL: environment.OPENPENCIL_CLOUD_COLLABORATION_URL,
    collaborationPort: v.parse(
      integerEnvironmentSchema,
      environment.OPENPENCIL_CLOUD_COLLABORATION_PORT
    ),
    databaseURL: environment.DATABASE_URL,
    authSecret: environment.BETTER_AUTH_SECRET,
    trustedOrigins:
      v.parse(originsEnvironmentSchema, environment.OPENPENCIL_CLOUD_TRUSTED_ORIGINS) ?? [],
    googleClientId: environment.GOOGLE_CLIENT_ID,
    googleClientSecret: environment.GOOGLE_CLIENT_SECRET,
    appleClientId: environment.APPLE_CLIENT_ID,
    appleTeamId: environment.APPLE_TEAM_ID,
    appleKeyId: environment.APPLE_KEY_ID,
    applePrivateKey: environment.APPLE_PRIVATE_KEY,
    appleAppBundleIdentifier: environment.APPLE_APP_BUNDLE_IDENTIFIER,
    s3Endpoint: environment.S3_ENDPOINT,
    s3Region: environment.S3_REGION,
    s3Bucket: environment.S3_BUCKET,
    s3AccessKeyId: environment.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: environment.S3_SECRET_ACCESS_KEY,
    s3SessionToken: environment.S3_SESSION_TOKEN,
    s3ForcePathStyle: v.parse(booleanEnvironmentSchema, environment.S3_FORCE_PATH_STYLE),
    s3ChecksumVerification: environment.S3_CHECKSUM_VERIFICATION,
    s3ServerSideEncryption: environment.S3_SERVER_SIDE_ENCRYPTION,
    s3KmsKeyId: environment.S3_KMS_KEY_ID,
    smtpHost: environment.OPENPENCIL_CLOUD_SMTP_HOST,
    smtpPort: v.parse(integerEnvironmentSchema, environment.OPENPENCIL_CLOUD_SMTP_PORT),
    smtpSecure: v.parse(booleanEnvironmentSchema, environment.OPENPENCIL_CLOUD_SMTP_SECURE),
    smtpUser: environment.OPENPENCIL_CLOUD_SMTP_USER,
    smtpPassword: environment.OPENPENCIL_CLOUD_SMTP_PASSWORD,
    emailFrom: environment.OPENPENCIL_CLOUD_EMAIL_FROM,
    cleanupEnabled: v.parse(booleanEnvironmentSchema, environment.OPENPENCIL_CLOUD_CLEANUP_ENABLED),
    cleanupBatchSize: v.parse(
      integerEnvironmentSchema,
      environment.OPENPENCIL_CLOUD_CLEANUP_BATCH_SIZE
    ),
    cleanupIntervalMs: v.parse(
      integerEnvironmentSchema,
      environment.OPENPENCIL_CLOUD_CLEANUP_INTERVAL_MS
    ),
    cleanupLeaseDurationMs: v.parse(
      integerEnvironmentSchema,
      environment.OPENPENCIL_CLOUD_CLEANUP_LEASE_MS
    ),
    documentRetentionMs: v.parse(
      integerEnvironmentSchema,
      environment.OPENPENCIL_CLOUD_DOCUMENT_RETENTION_MS
    )
  })
}
