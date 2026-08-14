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

export function cloudServerConfigFromEnvironment(environment: CloudEnvironment): CloudServerConfig {
  return parseCloudServerConfig({
    deployment: environment.OPENPENCIL_CLOUD_DEPLOYMENT ?? 'self-hosted',
    publicURL: environment.OPENPENCIL_CLOUD_URL,
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
    s3SecretAccessKey: environment.S3_SECRET_ACCESS_KEY
  })
}
