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

export type CloudflareCloudEnvironment = CloudEnvironment & {
  HYPERDRIVE: CloudflareHyperdrive
}

export function createCloudflareCloudRuntime(environment: CloudflareCloudEnvironment) {
  const config = cloudServerConfigFromEnvironment(environment)
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
