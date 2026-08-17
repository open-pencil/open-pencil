import * as v from 'valibot'

const httpURLSchema = v.pipe(
  v.string(),
  v.url(),
  v.check((value) => {
    const protocol = new URL(value).protocol
    return protocol === 'https:' || protocol === 'http:'
  }, 'URL must use HTTP or HTTPS')
)

const optionalTextSchema = v.optional(v.pipe(v.string(), v.trim(), v.minLength(1)))

const rawCloudServerConfigSchema = v.object({
  deployment: v.picklist(['official', 'self-hosted']),
  publicURL: httpURLSchema,
  appURL: v.optional(httpURLSchema),
  collaborationURL: v.optional(httpURLSchema),
  databaseURL: v.pipe(v.string(), v.url()),
  authSecret: v.pipe(v.string(), v.minLength(32)),
  trustedOrigins: v.optional(v.array(httpURLSchema), []),
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
  requireTogether(config, 'Google', ['googleClientId', 'googleClientSecret'])
  requireTogether(config, 'Apple', [
    'appleClientId',
    'appleTeamId',
    'appleKeyId',
    'applePrivateKey'
  ])
  requireTogether(config, 'SMTP', ['smtpHost', 'smtpPort', 'emailFrom'])
  requireTogether(config, 'SMTP authentication', ['smtpUser', 'smtpPassword'])
  if (config.deployment === 'official' && config.smtpHost && config.smtpSecure === false) {
    throw new CloudConfigError('Official SMTP delivery must use a secure connection')
  }
  if (config.s3KmsKeyId && config.s3ServerSideEncryption !== 'aws:kms') {
    throw new CloudConfigError('S3 KMS key ID requires aws:kms server-side encryption')
  }
  return config
}
