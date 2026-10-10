import { createS3ObjectStore } from '#cloud/runtime/s3/objects'
import {
  createCloudApp,
  createCloudAuthenticationRuntime,
  createDocumentCleanupService,
  createRateLimitCleanupService,
  createUploadCleanupService,
  startCleanupWorker,
  startTransactionalEmailWorker,
  withIndexingPolicy
} from '#cloud/server'
import { serve, type ServerType } from '@hono/node-server'

import { createMigratedNodeCloudDatabase } from './bootstrap'
import { createNodeTransactionalEmailRuntime } from './email-runtime'

export type NodeCloudServerOptions = {
  environment?: Readonly<Record<string, string | undefined>>
  port?: number
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
  const { auth, enrollment } = createCloudAuthenticationRuntime(config, database, email)
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
  const server = await listen(
    async (request) => {
      const path = new URL(request.url).pathname
      return withIndexingPolicy(await app.fetch(request), path, config.indexingPolicy)
    },
    options.port ?? Number(environment.PORT ?? 8787),
    environment.HOST ?? '0.0.0.0'
  )
  return {
    app,
    database,
    url: server.url,
    async stop() {
      await server.close()
      await cleanup?.stop()
      await emailWorker?.stop()
      await database.destroy()
    }
  }
}

async function listen(
  fetch: (request: Request) => Promise<Response>,
  port: number,
  hostname: string
) {
  let server: ServerType | undefined
  const url = await new Promise<URL>((resolve) => {
    server = serve({ fetch, hostname, port }, (info) => {
      resolve(new URL(`http://localhost:${info.port}`))
    })
  })
  return {
    url,
    close: () =>
      new Promise<void>((done, fail) => {
        if (!server) {
          done()
          return
        }
        server.close((error) => {
          if (error) fail(error)
          else done()
        })
      })
  }
}
