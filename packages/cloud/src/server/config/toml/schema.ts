import { cloudEditorVersionSchema } from '#cloud/contract'
import { deletedPrefixSchema } from '#cloud/server/config/schema'
import { staticEntitlementsTOMLSchema } from '#cloud/server/policy/schema'
import * as v from 'valibot'

/*
 * The deployment file, `openpencil-cloud.toml`: what an operator writes, with secrets named by the
 * environment variables that hold them. `../deployment.ts` reads it into the server's configuration.
 */

/** PostHog's EU Cloud ingestion host, where OpenPencil's own project is. */
const POSTHOG_DEFAULT_HOST = 'https://eu.i.posthog.com'

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
  servicesSigningKey: 'OPENPENCIL_CLOUD_SERVICES_SIGNING_KEY',
  internalServiceToken: 'OPENPENCIL_CLOUD_SERVICE_TOKEN',
  posthogProjectAPIKey: 'POSTHOG_PROJECT_API_KEY'
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
    listing: v.optional(v.strictObject({ minimum_editor_version: cloudEditorVersionSchema })),
    // Older editors ask to be updated, and the server refuses their requests.
    minimum_editor_version: v.optional(cloudEditorVersionSchema)
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
    /**
     * Keeps each file cleanup deletes under this prefix, such as `deleted/`, so a database restored
     * to an earlier time still finds it; a lifecycle rule on the prefix expires them.
     */
    deleted_prefix: v.optional(deletedPrefixSchema),
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
      retention_days: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 30),
      purge_grace_days: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 7)
    }),
    { retention_days: 30, purge_grace_days: 7 }
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
      // The values every account takes until billing or an operator stores its own: the free plan.
      v.strictObject({ source: v.literal('database'), ...staticEntitlementsTOMLSchema.entries })
    ])
  ),
  services: v.optional(
    v.strictObject({
      endpoint: urlSchema,
      signing_key: defaultReference(DEFAULT_SECRET_NAMES.servicesSigningKey),
      token_lifetime_minutes: v.optional(
        v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(60)),
        10
      )
    })
  ),
  billing: v.optional(v.strictObject({ endpoint: urlSchema })),
  internal_api: v.optional(
    v.strictObject({ service_token: defaultReference(DEFAULT_SECRET_NAMES.internalServiceToken) })
  ),
  /**
   * Optional: the operator's terms and privacy policy, linked at sign-up and in the portal, and
   * with `require_acceptance`, accepted once per `terms_version` before an account uses the server.
   */
  legal: v.optional(
    v.strictObject({
      terms_url: v.optional(urlSchema),
      privacy_url: v.optional(urlSchema),
      terms_version: v.optional(textSchema),
      require_acceptance: v.optional(v.boolean(), false),
      abuse_email: v.optional(v.pipe(v.string(), v.email())),
      minimum_age: v.optional(v.pipe(v.number(), v.integer(), v.minValue(13), v.maxValue(21)))
    })
  ),
  /**
   * Optional: a workspace whose documents anyone may open read-only, without signing in or a
   * link, as the deployment's community gallery. Everything saved there is public.
   */
  community: v.optional(v.strictObject({ workspace: v.pipe(v.string(), v.uuid()) })),
  /** Optional: reports server errors to PostHog error tracking. Leave it out to send nothing. */
  error_tracking: v.optional(
    v.strictObject({
      provider: v.literal('posthog'),
      host: v.optional(urlSchema, POSTHOG_DEFAULT_HOST),
      project_api_key: v.optional(configurableTextSchema, {
        from_env: DEFAULT_SECRET_NAMES.posthogProjectAPIKey
      })
    })
  )
})

export type CloudDeploymentConfig = v.InferOutput<typeof cloudDeploymentConfigSchema>
/** Deployment configuration as an operator writes it, before defaults are applied. */
export type CloudDeploymentInput = v.InferInput<typeof cloudDeploymentConfigSchema>
export type CloudSecretReference = v.InferOutput<typeof secretReferenceSchema>
