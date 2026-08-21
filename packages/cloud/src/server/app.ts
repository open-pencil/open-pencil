import {
  CLOUD_DISCOVERY_PATH,
  CLOUD_PROTOCOL_VERSION,
  parseCloudDiscovery,
  type CloudDiscovery
} from '#cloud/contract'
import {
  createCloudAPIRouter,
  createPublicCloudAPIRouter,
  type CloudAPIEnvironment
} from '#cloud/server/api'
import {
  configuredSocialProviders,
  createCloudSessionResolver,
  type CloudAuthAdapter,
  type CloudSessionResolver
} from '#cloud/server/auth'
import { createCollaborationTicketService } from '#cloud/server/collaboration'
import type { CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import { createDocumentService } from '#cloud/server/documents'
import type { InvitationDelivery } from '#cloud/server/invitations'
import type { ObjectStore } from '#cloud/server/objects'
import {
  createDefaultCloudPolicy,
  createEntitlementService,
  DatabaseEntitlementSource,
  EntitlementOpenFeatureProvider,
  StaticEntitlementSource,
  staticEntitlementValues,
  type CloudPolicy,
  type EntitlementSource
} from '#cloud/server/policy'
import { createDocumentSharingService } from '#cloud/server/sharing'
import { createWorkspaceService } from '#cloud/server/workspaces'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Kysely } from 'kysely'

export type CloudServices = {
  config: CloudServerConfig
  database: Kysely<CloudDatabase>
  auth: CloudAuthAdapter
  objects: ObjectStore
  resolveSession?: CloudSessionResolver
  invitationDelivery?: InvitationDelivery
  entitlementSource?: EntitlementSource
  policy?: CloudPolicy
}

type CloudEnvironment = CloudAPIEnvironment

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
      collaboration: true
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
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    credentials: true,
    maxAge: 600
  })
  const workspaces = createWorkspaceService(services.database)
  const entitlementSource =
    services.entitlementSource ??
    (services.config.staticEntitlements
      ? new StaticEntitlementSource(staticEntitlementValues(services.config.staticEntitlements))
      : new DatabaseEntitlementSource(services.database))
  const policy =
    services.policy ??
    createDefaultCloudPolicy(new EntitlementOpenFeatureProvider(entitlementSource))
  const documents = createDocumentService(services.database, services.objects, {
    policy,
    technicalMaximumUploadBytes: services.config.technicalLimits.maximumUploadBytes
  })
  const entitlements = createEntitlementService(
    services.database,
    policy,
    services.config.technicalLimits.maximumUploadBytes
  )
  const sharing = createDocumentSharingService(services.database, {
    delivery: services.invitationDelivery,
    continuationSecret: services.config.authSecret,
    publicURL: services.config.publicURL,
    appURL: services.config.appURL ?? services.config.publicURL,
    policy,
    deploymentMode: services.config.deployment
  })
  const collaboration = createCollaborationTicketService({
    database: services.database,
    sharing,
    authSecret: services.config.authSecret,
    collaborationURL: services.config.collaborationURL,
    policy,
    deploymentMode: services.config.deployment
  })

  const cloudAPI = createCloudAPIRouter({
    collaboration,
    documents,
    entitlements,
    sharing,
    workspaces,
    resolveSession
  })
  const publicCloudAPI = createPublicCloudAPIRouter({
    collaboration,
    documents,
    entitlements,
    sharing,
    workspaces,
    resolveSession
  })

  return new Hono<CloudEnvironment>()
    .use(CLOUD_DISCOVERY_PATH, cloudCORS)
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
    .route('/api', publicCloudAPI)
    .on(['GET', 'POST'], '/api/auth/*', (context) => services.auth.handler(context.req.raw))
    .use('/api/*', async (context, next) => {
      const actor = await resolveSession(context.req.raw)
      if (!actor) return context.json({ error: { code: 'unauthorized' as const } }, 401)
      context.set('actor', actor)
      return next()
    })
    .route('/api', cloudAPI)
}

export type CloudApp = ReturnType<typeof createCloudApp>
