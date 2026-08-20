import { createS3ObjectStore } from '#cloud/runtime/s3/objects'
import {
  cloudServerConfigFromEnvironment,
  createCloudApp,
  createCloudAuth,
  createCloudDatabase,
  createDocumentCleanupService,
  createUploadCleanupService,
  type CloudEnvironment
} from '#cloud/server'
import { PostgresDialect } from 'kysely'
import { Pool } from 'pg'

export type CloudflareHyperdrive = {
  connectionString: string
}

export type CloudflareCloudEnvironment = {
  HYPERDRIVE: CloudflareHyperdrive
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
  [key: string]: string | CloudflareHyperdrive | undefined
}

function stringEnvironment(environment: CloudflareCloudEnvironment): CloudEnvironment {
  return Object.fromEntries(
    Object.entries(environment).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  )
}

export function createCloudflareCloudRuntime(environment: CloudflareCloudEnvironment) {
  const config = cloudServerConfigFromEnvironment(stringEnvironment(environment))
  const database = createCloudDatabase({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: environment.HYPERDRIVE.connectionString, max: 5 })
    })
  })
  const objects = createS3ObjectStore(config)
  const auth = createCloudAuth(config, database)
  return {
    app: createCloudApp({ config, database, auth, objects }),
    database,
    cleanup: {
      documents: createDocumentCleanupService(database, objects),
      uploads: createUploadCleanupService(database, objects)
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
          })
        ]).finally(() => {
          void runtime.database.destroy()
        })
      )
    }
  }
}
