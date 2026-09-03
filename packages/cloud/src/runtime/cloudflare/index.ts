import { createS3ObjectStore } from '#cloud/runtime/s3/objects'
import {
  cloudServerConfigFromEnvironment,
  createCloudApp,
  createBetterAuthAdapter,
  createCloudDatabase,
  createDocumentCleanupService,
  createRateLimitCleanupService,
  createInvitationOutbox,
  createTransactionalEmailService,
  createUploadCleanupService,
  type CloudEnvironment
} from '#cloud/server'
import { PostgresDialect } from 'kysely'
import { Pool } from 'pg'

import { createCloudflareEmailTransport, type CloudflareEmailBinding } from './email'

export { createCloudflareEmailTransport, type CloudflareEmailBinding } from './email'

export type CloudflareHyperdrive = {
  connectionString: string
}

export type CloudflareAssetsBinding = {
  fetch(request: Request): Promise<Response>
}

export type CloudflareCloudEnvironment = {
  HYPERDRIVE: CloudflareHyperdrive
  EMAIL?: CloudflareEmailBinding
  ASSETS?: CloudflareAssetsBinding
  OPENPENCIL_CLOUD_DEPLOYMENT?: string
  OPENPENCIL_CLOUD_URL?: string
  OPENPENCIL_CLOUD_APP_URL?: string
  OPENPENCIL_CLOUD_TRUSTED_ORIGINS?: string
  BETTER_AUTH_SECRET?: string
  S3_ENDPOINT?: string
  S3_REGION?: string
  S3_BUCKET?: string
  S3_ACCESS_KEY_ID?: string
  S3_SECRET_ACCESS_KEY?: string
  S3_FORCE_PATH_STYLE?: string
  S3_CHECKSUM_VERIFICATION?: string
  [key: string]:
    | string
    | CloudflareAssetsBinding
    | CloudflareEmailBinding
    | CloudflareHyperdrive
    | undefined
}

function stringEnvironment(environment: CloudflareCloudEnvironment): CloudEnvironment {
  const values: Record<string, string> = Object.fromEntries(
    Object.entries(environment).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  )
  values.DATABASE_URL = environment.HYPERDRIVE.connectionString
  return values
}

export function createCloudflareCloudRuntime(environment: CloudflareCloudEnvironment) {
  const config = cloudServerConfigFromEnvironment(stringEnvironment(environment))
  const database = createCloudDatabase({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: environment.HYPERDRIVE.connectionString, max: 5 })
    })
  })
  const objects = createS3ObjectStore(config)
  const auth = createBetterAuthAdapter(config, database)
  const emailTransport =
    config.emailTransport === 'cloudflare' && environment.EMAIL
      ? createCloudflareEmailTransport(environment.EMAIL)
      : undefined
  if (config.emailTransport === 'cloudflare' && !emailTransport) {
    throw new Error('Cloudflare email transport requires the EMAIL binding')
  }
  const email = createTransactionalEmailService(database, {
    encryptionSecret: config.authSecret,
    from: config.emailFrom ?? '',
    transport: emailTransport
  })
  return {
    app: createCloudApp({
      config,
      database,
      auth,
      objects,
      invitationOutbox: emailTransport ? createInvitationOutbox(email) : undefined,
      transactionalEmail: email
    }),
    database,
    email,
    cleanup: {
      documents: createDocumentCleanupService(database, objects),
      uploads: createUploadCleanupService(database, objects),
      rateLimits: createRateLimitCleanupService(database)
    },
    config
  }
}

export type CloudflareExecutionContext = {
  waitUntil(promise: Promise<unknown>): void
}

export function createCloudflareWorker() {
  return {
    async fetch(
      request: Request,
      environment: CloudflareCloudEnvironment,
      context: CloudflareExecutionContext
    ): Promise<Response> {
      const runtime = createCloudflareCloudRuntime(environment)
      const url = new URL(request.url)
      if (
        environment.ASSETS &&
        (url.pathname === '/join' ||
          url.pathname === '/admin' ||
          url.pathname.startsWith('/admin/') ||
          url.pathname.startsWith('/assets/'))
      ) {
        const response = await environment.ASSETS.fetch(request)
        context.waitUntil(runtime.database.destroy())
        return response
      }
      const response = await runtime.app.fetch(request)
      context.waitUntil(runtime.database.destroy())
      return response
    },
    async scheduled(
      _event: unknown,
      environment: CloudflareCloudEnvironment,
      context: CloudflareExecutionContext
    ): Promise<void> {
      const runtime = createCloudflareCloudRuntime(environment)
      context.waitUntil(
        Promise.all([
          runtime.cleanup.uploads.cleanupExpiredUploads({
            batchSize: runtime.config.cleanupBatchSize,
            leaseDurationMs: runtime.config.cleanupLeaseDurationMs
          }),
          runtime.cleanup.documents.cleanupDeletedDocuments({
            batchSize: runtime.config.cleanupBatchSize,
            leaseDurationMs: runtime.config.cleanupLeaseDurationMs,
            retentionMs: runtime.config.documentRetentionMs
          }),
          runtime.cleanup.rateLimits.cleanupExpired(new Date(Date.now() - 24 * 60 * 60_000)),
          runtime.email.deliverPending({
            batchSize: runtime.config.emailBatchSize,
            leaseDurationMs: runtime.config.emailLeaseDurationMs,
            maximumAttempts: runtime.config.emailMaximumAttempts
          })
        ]).finally(() => {
          void runtime.database.destroy()
        })
      )
    }
  }
}
