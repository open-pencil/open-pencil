import { createS3ObjectStore } from '#cloud/runtime/s3/objects'
import {
  cloudServerConfigFromEnvironment,
  createCloudApp,
  createCloudAuth,
  createCollaborationStateStore,
  createDefaultCloudPolicy,
  DatabaseEntitlementSource,
  EntitlementOpenFeatureProvider,
  StaticEntitlementSource,
  staticEntitlementValues,
  createDocumentCleanupService,
  createUploadCleanupService,
  migrateCloudDatabase,
  CLOUD_FEATURE_KEYS,
  startCleanupWorker
} from '#cloud/server'

import { createCloudCollaborationRelay } from './collaboration'
import { loadNodeCloudServerConfig } from './config'
import { createNodeCloudDatabase } from './database'

export type NodeCloudServerOptions = {
  environment?: Readonly<Record<string, string | undefined>>
  port?: number
}

export async function startNodeCloudServer(options: NodeCloudServerOptions = {}) {
  const environment = options.environment ?? process.env
  const config =
    (await loadNodeCloudServerConfig(environment)) ?? cloudServerConfigFromEnvironment(environment)
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
  const relayEntitlementSource = config.staticEntitlements
    ? new StaticEntitlementSource(staticEntitlementValues(config.staticEntitlements))
    : new DatabaseEntitlementSource(database)
  const collaborationPolicy = createDefaultCloudPolicy(
    new EntitlementOpenFeatureProvider(relayEntitlementSource)
  )
  const collaboration = config.collaborationURL
    ? createCloudCollaborationRelay({
        authSecret: config.authSecret,
        stateStore: createCollaborationStateStore(database),
        async maximumParticipants(documentId) {
          const document = await database
            .selectFrom('document')
            .select('workspaceId')
            .where('id', '=', documentId)
            .executeTakeFirst()
          if (!document) return 0
          const value = await collaborationPolicy.number(
            CLOUD_FEATURE_KEYS.maximumParticipants,
            Number.MAX_SAFE_INTEGER,
            {
              targetingKey: document.workspaceId,
              workspaceId: document.workspaceId,
              documentId,
              deploymentMode: config.deployment
            }
          )
          return value === Number.MAX_SAFE_INTEGER ? null : value
        }
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
