import { defaultRelayURL } from '#cloud/contract'
import { createS3ObjectStore } from '#cloud/runtime/s3/objects'
import { createCloudServer, type SiteFiles } from '#cloud/runtime/site/server'
import {
  createCloudApp,
  loadAISigningKey,
  createCloudAuthenticationRuntime,
  createCollaborationRelay,
  createCollaborationStateStore,
  cleanupPassOptions,
  createCleanupServices,
  createConfiguredCloudPolicy,
  relayDocumentLookups,
  startCleanupWorker,
  startTransactionalEmailWorker
} from '#cloud/server'

import { createMigratedNodeCloudDatabase } from './bootstrap'
import { createNodeTransactionalEmailRuntime } from './email/runtime'
import { listen } from './listen'
import { attachCollaborationRelay } from './relay'
import { developmentSiteFiles, nodeSiteFiles } from './site'

export type NodeCloudServerOptions = {
  environment?: Readonly<Record<string, string | undefined>>
  port?: number
}

/** The site the server serves: a build, or in `cloud:dev` a development server's source. */
function siteFiles(
  environment: Readonly<Record<string, string | undefined>>
): SiteFiles | undefined {
  const developmentSite = environment.OPENPENCIL_CLOUD_DEV_SITE_URL
  if (developmentSite) return developmentSiteFiles(developmentSite)
  const siteDirectory = environment.OPENPENCIL_CLOUD_SITE_DIR
  if (siteDirectory) return nodeSiteFiles(siteDirectory)
  console.warn(
    '[Cloud] OPENPENCIL_CLOUD_SITE_DIR is not set; the editor and sign-in pages are off.'
  )
  return undefined
}

export async function startNodeCloudServer(options: NodeCloudServerOptions = {}) {
  const environment = options.environment ?? process.env
  const { config, database } = await createMigratedNodeCloudDatabase(environment)
  // Before any worker starts, so a key that cannot sign leaves nothing running.
  const aiSigningKey = await loadAISigningKey(config).catch(async (error: unknown) => {
    await database.destroy()
    throw error
  })
  const objects = createS3ObjectStore(config)
  const {
    email,
    invitationOutbox,
    transport: emailTransport
  } = createNodeTransactionalEmailRuntime(config, database)
  const { auth, enrollment } = createCloudAuthenticationRuntime(config, database, email)
  const policy = createConfiguredCloudPolicy(config, database)
  const cleanup = config.cleanupEnabled
    ? startCleanupWorker(createCleanupServices(config, database, objects, policy), {
        ...cleanupPassOptions(config),
        intervalMs: config.cleanupIntervalMs,
        onError: (error) => console.error('[Cloud] Cleanup worker failed:', error)
      })
    : undefined
  const relay = createCollaborationRelay({
    authSecret: config.authSecret,
    store: createCollaborationStateStore(database),
    maximumMessageBytes: config.technicalLimits.maximumCollaborationMessageBytes,
    maximumConnectionsPerRoom: config.technicalLimits.maximumConnectionsPerRoom,
    ...relayDocumentLookups(database, policy, config.deployment)
  })
  const app = createCloudApp({
    config,
    database,
    auth,
    objects,
    invitationOutbox,
    transactionalEmail: email,
    enrollment,
    aiSigningKey,
    relayURL: config.relayURL ?? defaultRelayURL(config.publicURL),
    onDocumentRestored: (documentId) => relay.startOver(documentId),
    onDocumentVersionsChanged: (documentId) => relay.announceVersions(documentId)
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
  const cloudServer = createCloudServer(app, {
    site: siteFiles(environment),
    indexingPolicy: config.indexingPolicy
  })
  const server = await listen(
    async (request) => cloudServer.fetch(request),
    options.port ?? Number(environment.PORT ?? 8787),
    environment.HOST ?? '0.0.0.0'
  )
  const relayListener = attachCollaborationRelay(
    server.http,
    relay,
    config.technicalLimits.maximumCollaborationMessageBytes
  )
  return {
    app,
    database,
    url: server.url,
    async stop() {
      await relayListener.close()
      await server.close()
      await cleanup?.stop()
      await emailWorker?.stop()
      await database.destroy()
    }
  }
}
