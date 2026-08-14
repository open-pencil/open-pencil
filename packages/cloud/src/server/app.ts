import {
  CLOUD_DISCOVERY_PATH,
  CLOUD_PROTOCOL_VERSION,
  parseCloudDiscovery,
  type CloudDiscovery
} from '#cloud/contract'
import {
  configuredSocialProviders,
  createCloudSessionResolver,
  type CloudActor,
  type CloudAuth,
  type CloudSessionResolver
} from '#cloud/server/auth'
import type { CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import { createDocumentRoutes, createDocumentService } from '#cloud/server/documents'
import type { ObjectStore } from '#cloud/server/objects'
import { createWorkspaceRoutes, createWorkspaceService } from '#cloud/server/workspaces'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Kysely } from 'kysely'

export type CloudServices = {
  config: CloudServerConfig
  database: Kysely<CloudDatabase>
  auth: CloudAuth
  objects: ObjectStore
  resolveSession?: CloudSessionResolver
}

type CloudEnvironment = {
  Variables: {
    actor: CloudActor
  }
}

function discoveryFromServices(services: CloudServices): CloudDiscovery {
  const apiURL = new URL('/api', services.config.publicURL).href.replace(/\/$/, '')
  const authURL = new URL('/api/auth', services.config.publicURL).href.replace(/\/$/, '')
  return parseCloudDiscovery({
    protocolVersion: CLOUD_PROTOCOL_VERSION,
    deployment: services.config.deployment,
    apiURL,
    authURL,
    authentication: {
      socialProviders: configuredSocialProviders(services.config),
      enterpriseSSO: false
    },
    capabilities: {
      documents: true,
      workspaces: true,
      collaboration: false
    }
  })
}

export function createCloudApp(services: CloudServices) {
  const discovery = discoveryFromServices(services)
  const resolveSession = services.resolveSession ?? createCloudSessionResolver(services.auth)
  const allowedOrigins = new Set(
    [services.config.publicURL, ...services.config.trustedOrigins].map(
      (origin) => new URL(origin).origin
    )
  )
  const cloudCORS = cors({
    origin: (origin) => (allowedOrigins.has(origin) ? origin : null),
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    credentials: true,
    maxAge: 600
  })
  const workspaces = createWorkspaceRoutes(createWorkspaceService(services.database))
  const documents = createDocumentRoutes(createDocumentService(services.database, services.objects))

  return new Hono<CloudEnvironment>()
    .use('/api/*', cloudCORS)
    .get('/health', (context) =>
      context.json({
        status: 'ok' as const,
        protocolVersion: CLOUD_PROTOCOL_VERSION
      })
    )
    .get('/ready', async (context) => {
      try {
        await services.database.selectFrom('workspace').select('id').limit(1).execute()
        const objects = await services.objects.checkReadiness()
        if (!objects.ok) {
          return context.json(
            { status: 'unavailable' as const, dependency: 'object_storage' as const },
            503
          )
        }
        return context.json({
          status: 'ready' as const,
          objectStorage: {
            checksumVerification: objects.checksumVerification,
            multipartUpload: services.objects.capabilities.multipartUpload
          }
        })
      } catch {
        return context.json({ status: 'unavailable' as const }, 503)
      }
    })
    .get(CLOUD_DISCOVERY_PATH, (context) => context.json(discovery))
    .on(['GET', 'POST'], '/api/auth/*', (context) => services.auth.handler(context.req.raw))
    .use('/api/*', async (context, next) => {
      const actor = await resolveSession(context.req.raw)
      if (!actor) return context.json({ error: { code: 'unauthorized' as const } }, 401)
      context.set('actor', actor)
      return next()
    })
    .get('/api/session', (context) => context.json({ user: context.get('actor') }))
    .route('/api', documents)
    .route('/api/workspaces', workspaces)
}

export type CloudApp = ReturnType<typeof createCloudApp>
