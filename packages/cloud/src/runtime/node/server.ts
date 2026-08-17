import {
  cloudServerConfigFromEnvironment,
  createCloudApp,
  createCloudAuth,
  createCollaborationStateStore,
  createDocumentCleanupService,
  createUploadCleanupService,
  migrateCloudDatabase,
  startCleanupWorker
} from '#cloud/server'

import { createS3ObjectStore } from '../s3/objects'
import { createCloudCollaborationRelay } from './collaboration'
import { createNodeCloudDatabase } from './database'

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
    ? startCleanupWorker(
        {
          documents: createDocumentCleanupService(database, objects),
          uploads: createUploadCleanupService(database, objects)
        },
        {
          batchSize: config.cleanupBatchSize,
          documentRetentionMs: config.documentRetentionMs,
          intervalMs: config.cleanupIntervalMs,
          leaseDurationMs: config.cleanupLeaseDurationMs,
          onError: (error) => console.error('[Cloud] Cleanup worker failed:', error)
        }
      )
    : undefined
  const app = createCloudApp({
    config,
    database,
    auth,
    objects
  })
  const collaboration = config.collaborationURL
    ? createCloudCollaborationRelay({
        authSecret: config.authSecret,
        stateStore: createCollaborationStateStore(database)
      })
    : undefined
  if (collaboration) await collaboration.listen(config.collaborationPort)
  const server = Bun.serve({
    fetch: app.fetch,
    hostname: '0.0.0.0',
    port: options.port ?? Number(environment.PORT ?? 8787)
  })
  return {
    app,
    database,
    server,
    collaboration,
    async stop() {
      await server.stop()
      await collaboration?.destroy()
      await cleanup?.stop()
      await database.destroy()
    }
  }
}
