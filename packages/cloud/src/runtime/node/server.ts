import {
  cloudServerConfigFromEnvironment,
  createCloudApp,
  createCloudAuth,
  createUploadCleanupService,
  migrateCloudDatabase,
  startCleanupWorker
} from '#cloud/server'

import { createNodeCloudDatabase } from './database'
import { createS3ObjectStore } from './objects'

export type NodeCloudServerOptions = {
  environment?: Readonly<Record<string, string | undefined>>
  port?: number
}

export async function startNodeCloudServer(options: NodeCloudServerOptions = {}) {
  const environment = options.environment ?? process.env
  const config = cloudServerConfigFromEnvironment(environment)
  const database = createNodeCloudDatabase({ connectionString: config.databaseURL })
  const auth = createCloudAuth(config, database)
  await migrateCloudDatabase(database, auth)
  const objects = createS3ObjectStore(config)
  const cleanup = config.cleanupEnabled
    ? startCleanupWorker(createUploadCleanupService(database, objects), {
        batchSize: config.cleanupBatchSize,
        intervalMs: config.cleanupIntervalMs,
        leaseDurationMs: config.cleanupLeaseDurationMs,
        onError: (error) => console.error('[Cloud] Cleanup worker failed:', error)
      })
    : undefined
  const app = createCloudApp({
    config,
    database,
    auth,
    objects
  })
  const server = Bun.serve({
    fetch: app.fetch,
    hostname: '0.0.0.0',
    port: options.port ?? Number(environment.PORT ?? 8787)
  })
  return {
    app,
    database,
    server,
    async stop() {
      await server.stop()
      await cleanup?.stop()
      await database.destroy()
    }
  }
}
