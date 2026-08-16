import { parseCloudServerConfig, type CloudServerConfig } from './schema'

export type CloudEnvironment = Readonly<Record<string, string | undefined>>

function splitOrigins(value: string | undefined): string[] {
  return value
    ? value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : []
}

function optionalBoolean(value: string | undefined): boolean | undefined {
  if (value == null) return undefined
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

function optionalInteger(value: string | undefined): number | undefined {
  if (value == null || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

export function cloudServerConfigFromEnvironment(environment: CloudEnvironment): CloudServerConfig {
  return parseCloudServerConfig({
    deployment: environment.OPENPENCIL_CLOUD_DEPLOYMENT ?? 'self-hosted',
    publicURL: environment.OPENPENCIL_CLOUD_URL,
    appURL: environment.OPENPENCIL_CLOUD_APP_URL,
    databaseURL: environment.DATABASE_URL,
    authSecret: environment.BETTER_AUTH_SECRET,
    trustedOrigins: splitOrigins(environment.OPENPENCIL_CLOUD_TRUSTED_ORIGINS),
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
    s3ForcePathStyle: optionalBoolean(environment.S3_FORCE_PATH_STYLE),
    s3ChecksumVerification: environment.S3_CHECKSUM_VERIFICATION,
    s3ServerSideEncryption: environment.S3_SERVER_SIDE_ENCRYPTION,
    s3KmsKeyId: environment.S3_KMS_KEY_ID,
    smtpHost: environment.OPENPENCIL_CLOUD_SMTP_HOST,
    smtpPort: optionalInteger(environment.OPENPENCIL_CLOUD_SMTP_PORT),
    smtpSecure: optionalBoolean(environment.OPENPENCIL_CLOUD_SMTP_SECURE),
    smtpUser: environment.OPENPENCIL_CLOUD_SMTP_USER,
    smtpPassword: environment.OPENPENCIL_CLOUD_SMTP_PASSWORD,
    emailFrom: environment.OPENPENCIL_CLOUD_EMAIL_FROM,
    cleanupEnabled: optionalBoolean(environment.OPENPENCIL_CLOUD_CLEANUP_ENABLED),
    cleanupBatchSize: optionalInteger(environment.OPENPENCIL_CLOUD_CLEANUP_BATCH_SIZE),
    cleanupIntervalMs: optionalInteger(environment.OPENPENCIL_CLOUD_CLEANUP_INTERVAL_MS),
    cleanupLeaseDurationMs: optionalInteger(environment.OPENPENCIL_CLOUD_CLEANUP_LEASE_MS),
    documentRetentionMs: optionalInteger(environment.OPENPENCIL_CLOUD_DOCUMENT_RETENTION_MS)
  })
}
