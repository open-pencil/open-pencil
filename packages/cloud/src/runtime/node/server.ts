import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { createS3ObjectStore } from '#cloud/runtime/s3/objects'
import {
  cloudDiscoveryFromConfig,
  createCloudApp,
  createBetterAuthAdapter,
  createCollaborationStateStore,
  createDefaultCloudPolicy,
  DatabaseEntitlementSource,
  EntitlementOpenFeatureProvider,
  StaticEntitlementSource,
  staticEntitlementValues,
  createDocumentCleanupService,
  createEnrollmentService,
  createRateLimitCleanupService,
  createUploadCleanupService,
  CLOUD_FEATURE_KEYS,
  startCleanupWorker,
  startTransactionalEmailWorker,
  withIndexingPolicy
} from '#cloud/server'

import { createNodeAdminAssetHandler } from './admin-assets'
import { createMigratedNodeCloudDatabase } from './bootstrap'
import { createCloudCollaborationRelay } from './collaboration'
import { createNodeTransactionalEmailRuntime } from './email-runtime'

export type NodeCloudServerOptions = {
  environment?: Readonly<Record<string, string | undefined>>
  port?: number
}

function adminAssetDirectory(): string {
  const builtPackageAssets = join(import.meta.dir, 'admin')
  if (existsSync(builtPackageAssets)) return builtPackageAssets
  return join(import.meta.dir, '../../../dist/admin')
}

export async function startNodeCloudServer(options: NodeCloudServerOptions = {}) {
  const environment = options.environment ?? process.env
  const { config, database } = await createMigratedNodeCloudDatabase(environment)
  const objects = createS3ObjectStore(config)
  const {
    email,
    invitationOutbox,
    transport: emailTransport
  } = createNodeTransactionalEmailRuntime(config, database)
  const enrollment = createEnrollmentService(database, {
    appURL: config.appURL ?? config.publicURL,
    adminRecipients: config.enrollmentAdminNotificationEmails,
    email
  })
  const auth = createBetterAuthAdapter(config, database, enrollment)
  const cleanup = config.cleanupEnabled
    ? startCleanupWorker(
        {
          documents: createDocumentCleanupService(database, objects),
          uploads: createUploadCleanupService(database, objects),
          rateLimits: createRateLimitCleanupService(database)
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
    objects,
    invitationOutbox,
    transactionalEmail: email,
    enrollment
  })
  const emailWorker = emailTransport
    ? startTransactionalEmailWorker(email, {
        batchSize: config.emailBatchSize,
        intervalMs: config.emailIntervalMs,
        leaseDurationMs: config.emailLeaseDurationMs,
        maximumAttempts: config.emailMaximumAttempts,
        onError: (error) => console.error('[Cloud] Email worker failed:', error)
      })
    : undefined
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
        maximumMessageBytes: config.technicalLimits.maximumCollaborationMessageBytes,
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
  const adminAssets = createNodeAdminAssetHandler(
    adminAssetDirectory(),
    cloudDiscoveryFromConfig(config)
  )
  const server = Bun.serve({
    async fetch(request) {
      const path = new URL(request.url).pathname
      const response = (await adminAssets(request)) ?? (await app.fetch(request))
      return withIndexingPolicy(response, path, config.indexingPolicy)
    },
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
      await emailWorker?.stop()
      await database.destroy()
    }
  }
}
