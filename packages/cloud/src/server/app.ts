import {
  createAdminAuditService,
  createAdminEmailService,
  createAdminOperationsService,
  createAdminUserService,
  createCloudAdminRoutes,
  createEnrollmentService,
  type EnrollmentService
} from '#cloud/admin'
import {
  CLOUD_AI_JWKS_PATH,
  CLOUD_DISCOVERY_PATH,
  CLOUD_PROTOCOL_VERSION,
  type CloudDiscovery
} from '#cloud/contract'
import { createAccountRoutes } from '#cloud/server/account/routes'
import { createAITokenService, type AISigningKey } from '#cloud/server/ai'
import {
  createCloudAPIRouter,
  createPublicCloudAPIRouter,
  type CloudAPIEnvironment
} from '#cloud/server/api'
import {
  AUTH_BASE_PATH,
  createAuthenticationEmailService,
  createCloudIdentityResolver,
  createCloudSessionResolver,
  type CloudAuthAdapter,
  type CloudIdentityResolver,
  type CloudSessionResolver
} from '#cloud/server/auth'
import { createCollaborationTicketService } from '#cloud/server/collaboration'
import {
  CloudConfigError,
  cloudDiscoveryFromConfig,
  type CloudServerConfig
} from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import { createDocumentService } from '#cloud/server/documents'
import { createDocumentVersionService } from '#cloud/server/documents/versions'
import type { TransactionalEmailService } from '#cloud/server/email'
import { createInternalRoutes, createInternalService } from '#cloud/server/internal'
import type { InvitationDelivery, InvitationOutbox } from '#cloud/server/invitations'
import type { ObjectStore } from '#cloud/server/objects'
import { createPictureRoutes, createUserPictures } from '#cloud/server/pictures'
import {
  createConfiguredCloudPolicy,
  createDefaultCloudPolicy,
  createEntitlementService,
  EntitlementOpenFeatureProvider,
  type CloudPolicy,
  type EntitlementSource
} from '#cloud/server/policy'
import {
  CLOUD_RATE_LIMITS,
  createActorRateLimiter,
  createTrustedIPRateLimiter,
  routeHasOwnBudget
} from '#cloud/server/rate-limit'
import { createDocumentSharingService } from '#cloud/server/sharing'
import { createWorkspaceMemberService, createWorkspaceService } from '#cloud/server/workspaces'
import { Hono, type Context } from 'hono'
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
  /** The imported `aiSigningKey`, required when the config names one. See `loadAISigningKey`. */
  aiSigningKey?: AISigningKey
  /**
   * Where clients reach this runtime's collaboration relay. Without one, Cloud rooms fall back to
   * peer-to-peer and writes are not enforced by the server.
   */
  relayURL?: string
  /** Ends a restored document's live rooms, on the relay this runtime runs, if any. */
  onDocumentRestored?: (documentId: string) => void
  /** Tells a document's live rooms its version history changed, on the relay this runtime runs. */
  onDocumentVersionsChanged?: (documentId: string) => void
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
    path.startsWith('/auth') ||
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
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 600
  })
  const workspaces = createWorkspaceService(services.database)
  const pictures = createUserPictures(services.database, { publicURL: services.config.publicURL })
  const workspaceMembers = createWorkspaceMemberService(services.database, {
    email: services.transactionalEmail,
    publicURL: services.config.publicURL
  })
  const enrollment =
    services.enrollment ??
    createEnrollmentService(services.database, {
      publicURL: services.config.publicURL,
      adminRecipients: services.config.enrollmentAdminNotificationEmails,
      email: services.transactionalEmail
    })
  const admin = createCloudAdminRoutes(
    {
      email: createAdminEmailService(services.database, services.transactionalEmail, {
        publicURL: services.config.publicURL
      }),
      enrollment,
      users: createAdminUserService(services.database, services.auth, {
        requireMFA: services.config.deploymentAdminMFARequired,
        pictures,
        notify: services.transactionalEmail
          ? createAuthenticationEmailService(services.transactionalEmail, services.config.publicURL)
          : undefined
      }),
      audit: createAdminAuditService(services.database),
      operations: createAdminOperationsService(services.database, services.config)
    },
    allowedOrigins,
    {
      database: services.database,
      secret: services.config.authSecret,
      auth: services.auth,
      requireMFA: services.config.deploymentAdminMFARequired
    }
  )
  const policy =
    services.policy ??
    (services.entitlementSource
      ? createDefaultCloudPolicy(new EntitlementOpenFeatureProvider(services.entitlementSource))
      : createConfiguredCloudPolicy(services.config, services.database))
  const documents = createDocumentService(services.database, services.objects, {
    policy,
    technicalMaximumUploadBytes: services.config.technicalLimits.maximumUploadBytes,
    onVersionsChanged: services.onDocumentVersionsChanged
  })
  const versions = createDocumentVersionService(services.database, services.objects, {
    policy,
    deploymentMode: services.config.deployment,
    onRestored: services.onDocumentRestored,
    onVersionsChanged: services.onDocumentVersionsChanged
  })
  const entitlements = createEntitlementService(
    services.database,
    policy,
    services.config.technicalLimits.maximumUploadBytes,
    services.config.technicalLimits.maximumConnectionsPerRoom
  )
  const sharing = createDocumentSharingService(services.database, {
    delivery: services.invitationDelivery,
    outbox: services.invitationOutbox,
    continuationSecret: services.config.authSecret,
    publicURL: services.config.publicURL,
    policy,
    deploymentMode: services.config.deployment,
    workspaceInvitations: workspaceMembers
  })
  const collaboration = createCollaborationTicketService({
    database: services.database,
    sharing,
    authSecret: services.config.authSecret,
    relayURL: services.relayURL,
    policy,
    deploymentMode: services.config.deployment
  })
  if (services.config.aiSigningKey && !services.aiSigningKey) {
    throw new CloudConfigError('The AI service needs the signing key imported by loadAISigningKey')
  }
  const aiTokens = services.aiSigningKey
    ? createAITokenService({
        database: services.database,
        policy,
        deploymentMode: services.config.deployment,
        issuer: new URL(services.config.publicURL).origin,
        signingKey: services.aiSigningKey,
        lifetimeSeconds: services.config.aiTokenLifetimeSeconds
      })
    : undefined

  const requireActiveSession = async (context: Context, next: () => Promise<void>) => {
    const actor = await resolveSession(context.req.raw)
    if (!actor) return context.json({ error: { code: 'unauthorized' as const } }, 401)
    context.set('actor', actor)
    return next()
  }
  const publicRateLimiter = createTrustedIPRateLimiter(
    services.database,
    services.config.authSecret,
    CLOUD_RATE_LIMITS.publicCapability,
    { trustedHeaders: services.config.authTrustedIPHeaders },
    (context) => context.json({ error: { code: 'not_found' as const } }, 404),
    {
      resource: (context) => context.req.path,
      // Guests refresh collaboration tickets on their own budget, `publicCollaborationLimiter`.
      skip: routeHasOwnBudget
    }
  )
  const publicCollaborationLimiter = createTrustedIPRateLimiter(
    services.database,
    services.config.authSecret,
    CLOUD_RATE_LIMITS.collaborationTicket,
    { trustedHeaders: services.config.authTrustedIPHeaders },
    (context) => context.json({ error: { code: 'not_found' as const } }, 404),
    { resource: (context) => context.req.path, route: true }
  )
  const authenticatedMutationLimiter = createActorRateLimiter(
    services.database,
    services.config.authSecret,
    CLOUD_RATE_LIMITS.authenticatedMutation,
    // Reads are free, and a route with a budget of its own, such as creating documents, counts
    // against that instead.
    (context) => context.req.method === 'GET' || routeHasOwnBudget(context)
  )

  const accountRoutes = createAccountRoutes({
    auth: services.auth,
    pictures,
    config: services.config,
    enrollment,
    workspaces,
    resolveIdentity,
    resolveSession,
    requireActiveSession,
    authenticatedMutationLimiter
  })
  const cloudAPI = createCloudAPIRouter({
    collaboration,
    database: services.database,
    rateLimitSecret: services.config.authSecret,
    documents,
    versions,
    entitlements,
    aiTokens,
    sharing,
    workspaces,
    workspaceMembers,
    resolveSession
  })
  const publicCloudAPI = createPublicCloudAPIRouter({
    collaboration,
    documents,
    versions,
    entitlements,
    sharing,
    workspaces,
    workspaceMembers,
    resolveSession
  })

  // Services such as billing authenticate with their own token, not a session.
  const internalAPI = services.config.internalServiceToken
    ? createInternalRoutes(
        createInternalService(services.database),
        services.config.internalServiceToken
      )
    : new Hono()

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
          : 'User-agent: *\nDisallow: /admin\nDisallow: /account\nDisallow: /app\nDisallow: /api\nDisallow: /auth\nDisallow: /sign-in\nDisallow: /sign-up\nDisallow: /join\nDisallow: /.well-known\n'
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
    .get(CLOUD_AI_JWKS_PATH, async (context) =>
      aiTokens ? context.json(aiTokens.jwks()) : context.notFound()
    )
    .on(['GET', 'POST'], `${AUTH_BASE_PATH}/*`, (context) => services.auth.handler(context.req.raw))
    .route('/', accountRoutes)
    .route('/', createPictureRoutes(pictures))
    .use('/api/shares/:shareId/collaboration-ticket', publicCollaborationLimiter)
    .use('/api/public/*', publicRateLimiter)
    .use('/api/shares/*', publicRateLimiter)
    .use('/api/invitations/*', publicRateLimiter)
    .route('/api', publicCloudAPI)
    .route('/api/internal', internalAPI)
    .use('/api/*', requireActiveSession)
    .route('/api/admin', admin)
    .use('/api/*', authenticatedMutationLimiter)
    .route('/api', cloudAPI)
}

export type CloudApp = ReturnType<typeof createCloudApp>
