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
  s3KmsKeyId: optionalTextSchema
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
  requireTogether(config, 'Google', ['googleClientId', 'googleClientSecret'])
  requireTogether(config, 'Apple', [
    'appleClientId',
    'appleTeamId',
    'appleKeyId',
    'applePrivateKey'
  ])
  if (config.s3KmsKeyId && config.s3ServerSideEncryption !== 'aws:kms') {
    throw new CloudConfigError('S3 KMS key ID requires aws:kms server-side encryption')
  }
  return config
}
