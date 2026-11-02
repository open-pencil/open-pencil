import { defaultRelayURL, RELAY_PATH } from '#cloud/contract'
import { createPostgresCloudDatabase } from '#cloud/runtime/postgres/database'
import { createS3ObjectStore } from '#cloud/runtime/s3/objects'
import { createCloudServer } from '#cloud/runtime/site/server'
import {
  cleanupPassOptions,
  createCleanupServices,
  createCloudApp,
  createCloudAuthenticationRuntime,
  createConfiguredCloudPolicy,
  createInvitationOutbox,
  createTransactionalEmailService,
  runCleanup,
  type TransactionalEmailService
} from '#cloud/server'
import { Hono } from 'hono'

import { createCloudflareEmailTransport } from './email'
import {
  cloudflareCloudSetup,
  type CloudflareCloudEnvironment,
  type PreparedCloudflareCloud
} from './environment'
import { createCloudflareRelayObject, relayFor, routeToRelay } from './relay'
import { assetSiteFiles } from './site'

function emailTransport({ config }: PreparedCloudflareCloud, env: CloudflareCloudEnvironment) {
  if (config.emailTransport !== 'cloudflare') return undefined
  if (!env.EMAIL) throw new Error('[email] transport = "cloudflare" needs the EMAIL binding')
  return createCloudflareEmailTransport(env.EMAIL)
}

/**
 * What one request or cron run needs. Workers can't share connections between requests, so each
 * gets its own database client, closed once its background work settles.
 */
function cloudServices(
  prepared: PreparedCloudflareCloud,
  env: CloudflareCloudEnvironment,
  context: Pick<ExecutionContext, 'waitUntil'>
) {
  const { config } = prepared
  const database = createPostgresCloudDatabase({ connectionString: config.databaseURL })
  const objects = createS3ObjectStore(config)
  const transport = emailTransport(prepared, env)
  const queued = createTransactionalEmailService(database, {
    encryptionSecret: config.authSecret,
    from: config.emailFrom ?? '',
    transport
  })
  // Mail is sent once the request is done rather than by a polling worker, so sign-in links
  // don't wait for the next cron run.
  let enqueued = false
  const email: TransactionalEmailService = {
    ...queued,
    enqueue(input, transaction) {
      enqueued = true
      return queued.enqueue(input, transaction)
    }
  }
  const background: Promise<unknown>[] = []
  const runInBackground = (task: Promise<unknown>) => {
    background.push(
      task.catch((error: unknown) => console.error('[Cloud] Background work failed:', error))
    )
  }
  const deliver = () =>
    email.deliverPending({
      batchSize: config.emailBatchSize,
      leaseDurationMs: config.emailLeaseDurationMs,
      maximumAttempts: config.emailMaximumAttempts
    })
  return {
    config,
    database,
    objects,
    email,
    transport,
    runInBackground,
    deliver,
    /** Sends what the request queued and closes the database after everything it started. */
    finish() {
      context.waitUntil(
        Promise.allSettled(background)
          .then(() => (enqueued && transport ? deliver() : undefined))
          .catch((error: unknown) => console.error('[Cloud] Sending email failed:', error))
          .then(() => database.destroy())
      )
    }
  }
}

/**
 * OpenPencil Cloud on Cloudflare Workers, configured by a deployment TOML. The Worker serves the
 * API, the editor, and the portal per request, a Durable Object per document runs its collaboration rooms, and a
 * Cron Trigger runs cleanup and retries email.
 */
export function createCloudflareCloud(configSource: string) {
  const prepare = cloudflareCloudSetup(configSource)

  const router = new Hono<{ Bindings: CloudflareCloudEnvironment }>()
    .get(RELAY_PATH, routeToRelay)
    .all('*', async (c) => {
      const prepared = await prepare(c.env)
      const services = cloudServices(prepared, c.env, c.executionCtx)
      const { config, database, email, transport, runInBackground } = services
      try {
        const { auth, enrollment } = createCloudAuthenticationRuntime(config, database, email, {
          runInBackground,
          validateSchema: false
        })
        const app = createCloudApp({
          config,
          database,
          auth,
          objects: services.objects,
          invitationOutbox: transport ? createInvitationOutbox(email) : undefined,
          transactionalEmail: email,
          enrollment,
          aiSigningKey: prepared.aiSigningKey,
          relayURL: config.relayURL ?? defaultRelayURL(config.publicURL),
          onDocumentRestored: (documentId) =>
            runInBackground(relayFor(c.env, documentId).startOver(documentId)),
          onDocumentVersionsChanged: (documentId) =>
            runInBackground(relayFor(c.env, documentId).announceVersions(documentId))
        })
        return await createCloudServer(app, {
          site: assetSiteFiles(c.env.ASSETS),
          indexingPolicy: config.indexingPolicy
        }).fetch(c.req.raw)
      } finally {
        services.finish()
      }
    })

  const worker: ExportedHandler<CloudflareCloudEnvironment> = {
    fetch: (request, env, context) => router.fetch(request, env, context),

    async scheduled(_controller, env, context) {
      const prepared = await prepare(env)
      const services = cloudServices(prepared, env, context)
      const { config, database, objects } = services
      try {
        if (config.cleanupEnabled) {
          const policy = createConfiguredCloudPolicy(config, database)
          await runCleanup(
            createCleanupServices(config, database, objects, policy),
            cleanupPassOptions(config)
          )
        }
        // Retries what failed to send after its request, and what a full batch left behind.
        if (services.transport) await services.deliver()
      } finally {
        services.finish()
      }
    }
  }

  return { worker, CollaborationRelayObject: createCloudflareRelayObject(prepare) }
}
