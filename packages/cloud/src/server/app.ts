import {
  createAdminAuditService,
  createAdminEmailService,
  createAdminOperationsService,
  createAdminUserService,
  createCloudAdminRoutes,
  createEnrollmentService,
  type EnrollmentService
} from '#cloud/admin'
import { CLOUD_DISCOVERY_PATH, CLOUD_PROTOCOL_VERSION, type CloudDiscovery } from '#cloud/contract'
import {
  createCloudAPIRouter,
  createPublicCloudAPIRouter,
  type CloudAPIEnvironment
} from '#cloud/server/api'
import {
  createCloudIdentityResolver,
  createCloudSessionResolver,
  type CloudAuthAdapter,
  type CloudIdentityResolver,
  type CloudSessionResolver
} from '#cloud/server/auth'
import { createCollaborationTicketService } from '#cloud/server/collaboration'
import { cloudDiscoveryFromConfig, type CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import { createDocumentService } from '#cloud/server/documents'
import type { TransactionalEmailService } from '#cloud/server/email'
import type { InvitationDelivery, InvitationOutbox } from '#cloud/server/invitations'
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
import {
  CLOUD_RATE_LIMITS,
  createActorRateLimiter,
  createTrustedIPRateLimiter
} from '#cloud/server/rate-limit'
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
  resolveIdentity?: CloudIdentityResolver
  resolveSession?: CloudSessionResolver
  invitationDelivery?: InvitationDelivery
  invitationOutbox?: InvitationOutbox
  transactionalEmail?: TransactionalEmailService
  enrollment?: EnrollmentService
  entitlementSource?: EntitlementSource
  policy?: CloudPolicy
}

type CloudEnvironment = CloudAPIEnvironment

function discoveryFromServices(services: CloudServices): CloudDiscovery {
  return cloudDiscoveryFromConfig(services.config)
}

export function shouldPreventIndexing(path: string, policy: 'allow' | 'deny'): boolean {
  return (
    policy === 'deny' ||
    path.startsWith('/api/') ||
    path.startsWith('/admin') ||
    path.startsWith('/account') ||
    path === '/app' ||
    path === '/sign-in' ||
    path === '/sign-up' ||
    path === '/join' ||
    path === CLOUD_DISCOVERY_PATH
  )
}

export function withIndexingPolicy(
  response: Response,
  path: string,
  policy: 'allow' | 'deny'
): Response {
  if (!shouldPreventIndexing(path, policy)) return response
  const headers = new Headers(response.headers)
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

export function createCloudApp(services: CloudServices) {
  const discovery = discoveryFromServices(services)
  const resolveIdentity = services.resolveIdentity ?? createCloudIdentityResolver(services.auth)
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
  const enrollment =
    services.enrollment ??
    createEnrollmentService(services.database, {
      appURL: services.config.appURL ?? services.config.publicURL,
      adminRecipients: services.config.enrollmentAdminNotificationEmails,
      email: services.transactionalEmail
    })
  const admin = createCloudAdminRoutes(
    {
      email: createAdminEmailService(
        services.database,
        services.transactionalEmail,
        services.config.appURL ?? services.config.publicURL
      ),
      enrollment,
      users: createAdminUserService(services.database, services.auth),
      audit: createAdminAuditService(services.database),
      operations: createAdminOperationsService(services.database, services.config)
    },
    allowedOrigins,
    { database: services.database, secret: services.config.authSecret }
  )
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
    outbox: services.invitationOutbox,
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

  const publicRateLimiter = createTrustedIPRateLimiter(
    services.database,
    services.config.authSecret,
    CLOUD_RATE_LIMITS.publicCapability,
    { trustedHeaders: services.config.authTrustedIPHeaders },
    (context) => context.json({ error: { code: 'not_found' as const } }, 404),
    { resource: (context) => context.req.path }
  )
  const publicCollaborationLimiter = createTrustedIPRateLimiter(
    services.database,
    services.config.authSecret,
    CLOUD_RATE_LIMITS.collaborationTicket,
    { trustedHeaders: services.config.authTrustedIPHeaders },
    (context) => context.json({ error: { code: 'not_found' as const } }, 404),
    { resource: (context) => context.req.path }
  )
  const authenticatedMutationLimiter = createActorRateLimiter(
    services.database,
    services.config.authSecret,
    CLOUD_RATE_LIMITS.authenticatedMutation,
    (context) =>
      context.req.method === 'GET' ||
      context.req.path.endsWith('/collaboration-ticket') ||
      context.req.path.endsWith('/invitations') ||
      context.req.path.endsWith('/uploads') ||
      /^\/api\/workspaces(?:\/[^/]+\/documents)?$/.test(context.req.path)
  )

  const cloudAPI = createCloudAPIRouter({
    collaboration,
    database: services.database,
    rateLimitSecret: services.config.authSecret,
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
    .use('*', async (context, next) => {
      await next()
      if (shouldPreventIndexing(context.req.path, services.config.indexingPolicy)) {
        context.header('X-Robots-Tag', 'noindex, nofollow, noarchive')
      }
    })
    .get('/robots.txt', (context) => {
      context.header('Content-Type', 'text/plain; charset=utf-8')
      return context.body(
        services.config.indexingPolicy === 'deny'
          ? 'User-agent: *\nDisallow: /\n'
          : 'User-agent: *\nDisallow: /admin\nDisallow: /account\nDisallow: /app\nDisallow: /api\nDisallow: /sign-in\nDisallow: /sign-up\nDisallow: /join\nDisallow: /.well-known\n'
      )
    })
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
    .get('/api/account/status', async (context) => {
      const identity = await resolveIdentity(context.req.raw)
      if (!identity) return context.json({ error: { code: 'unauthorized' as const } }, 401)
      let enrollmentStatus = await enrollment.statusForEmail(identity.email)
      if (services.config.enrollmentMode === 'approval' && !enrollmentStatus) {
        await enrollment.request({ email: identity.email, name: identity.name })
        enrollmentStatus = 'pending'
      }
      const state =
        services.config.enrollmentMode !== 'approval' || enrollmentStatus === 'approved'
          ? ('active' as const)
          : (enrollmentStatus ?? 'pending')
      return context.json({ user: identity, state })
    })
    .use('/api/public/shares/:shareId/collaboration-ticket', publicCollaborationLimiter)
    .use('/api/public/*', publicRateLimiter)
    .use('/api/shares/*', publicRateLimiter)
    .use('/api/invitations/*', publicRateLimiter)
    .route('/api', publicCloudAPI)
    .use('/api/*', async (context, next) => {
      const actor = await resolveSession(context.req.raw)
      if (!actor) return context.json({ error: { code: 'unauthorized' as const } }, 401)
      context.set('actor', actor)
      return next()
    })
    .route('/api/admin', admin)
    .use('/api/*', authenticatedMutationLimiter)
    .route('/api', cloudAPI)
}

export type CloudApp = ReturnType<typeof createCloudApp>
