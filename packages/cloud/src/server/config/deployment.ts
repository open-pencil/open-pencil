import { staticEntitlementsFromTOML } from '#cloud/server/policy/static'
import { parse as parseTOML } from 'smol-toml'
import * as v from 'valibot'

import {
  cloudDeploymentConfigSchema,
  parseCloudServerConfig,
  type CloudDeploymentConfig,
  type CloudSecretReference,
  type CloudServerConfig
} from './schema'

export type CloudEnvironment = Readonly<Record<string, string | undefined>>

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
  return staticEntitlementsFromTOML(config.entitlements)
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
    documentRetentionMs: config.documents.retention_days * 86_400_000
  }
}

function serviceConfig(config: CloudDeploymentConfig, environment: CloudEnvironment) {
  return {
    aiEndpoint: config.ai?.endpoint,
    aiSigningKey: config.ai ? requiredSecret(environment, config.ai.signing_key) : undefined,
    aiTokenLifetimeSeconds: config.ai ? config.ai.token_lifetime_minutes * 60 : undefined,
    billingPortalURL: config.billing?.portal_url,
    internalServiceToken: config.internal_api
      ? requiredSecret(environment, config.internal_api.service_token)
      : undefined
  }
}

/** Hard limits, whatever a plan allows; each lives in the section it limits. */
function technicalLimits(config: CloudDeploymentConfig) {
  return {
    maximumUploadBytes: config.object_storage.maximum_upload_bytes,
    maximumCollaborationMessageBytes: config.collaboration.maximum_message_bytes,
    maximumConnectionsPerRoom: config.collaboration.maximum_connections_per_room
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
    indexingPolicy: config.deployment.indexing,
    trustedOrigins: config.deployment.trusted_origins,
    localEditor: config.deployment.local_editor,
    listingMinimumEditorVersion: config.deployment.listing?.minimum_editor_version,
    databaseURL: requiredSecret(environment, config.database.url),
    authSecret: requiredSecret(environment, config.authentication.secret),
    enrollmentMode: config.authentication.enrollment.mode,
    enrollmentAdminNotificationEmails: config.authentication.enrollment.notification_emails,
    emailPasswordEnabled: config.authentication.email_password.enabled,
    emailPasswordSignUpEnabled: config.authentication.email_password.sign_up,
    emailPasswordMinimumLength: config.authentication.email_password.minimum_password_length,
    emailPasswordMaximumLength: config.authentication.email_password.maximum_password_length,
    emailVerificationExpiresIn:
      config.authentication.email_password.verification_link_lifetime_minutes * 60,
    passwordResetExpiresIn:
      config.authentication.email_password.password_reset_link_lifetime_minutes * 60,
    compromisedPasswordCheck: config.authentication.email_password.compromised_password_check,
    deploymentAdminMFARequired: config.authentication.mfa.required_for_admins,
    totpEnabled: config.authentication.mfa.totp,
    recoveryCodesEnabled: config.authentication.mfa.recovery_codes,
    mfaTrustedDeviceDays: config.authentication.mfa.trusted_device_lifetime_days,
    passkeysEnabled: config.authentication.passkeys.enabled,
    passkeyRPName: config.authentication.passkeys.rp_name,
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
    relayURL: config.collaboration.relay_url,
    staticEntitlements: staticEntitlements(config),
    ...emailConfig(config, environment),
    ...workerConfig(config),
    ...serviceConfig(config, environment),
    technicalLimits: technicalLimits(config)
  })
}

export function parseCloudDeploymentTOML(
  source: string,
  environment: CloudEnvironment
): CloudServerConfig {
  return parseCloudDeploymentConfig(parseCloudDeploymentSource(source), environment)
}
