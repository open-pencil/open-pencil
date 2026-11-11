import {
  createAdminAuditService,
  createAdminDocumentService,
  createAdminEmailService,
  createAdminOperationsService,
  createAdminReportService,
  createAdminUserService,
  createCloudAdminRoutes,
  createEnrollmentService,
  type EnrollmentService
} from '#cloud/admin'
import {
  CLOUD_API_MAX_BODY_BYTES,
  CLOUD_SERVICES_JWKS_PATH,
  CLOUD_DISCOVERY_PATH,
  CLOUD_PROTOCOL_VERSION,
  type CloudDiscovery
} from '#cloud/contract'
import { createAccountDeletionService } from '#cloud/server/account/deletion'
import { createAccountRoutes } from '#cloud/server/account/routes'
import { createTermsService } from '#cloud/server/account/terms'
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
import { cloudErrorHandler, type CloudErrorReporter } from '#cloud/server/errors'
import { createInternalRoutes, createInternalService } from '#cloud/server/internal'
import type { InvitationDelivery, InvitationOutbox } from '#cloud/server/invitations'
import { cloudRequestId, type ForwardedRequestId } from '#cloud/server/logging'
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
import { createDocumentReportService } from '#cloud/server/reports'
import { createServicesTokenService, type ServicesSigningKey } from '#cloud/server/services'
import { createDocumentSharingService } from '#cloud/server/sharing'
import { createWorkspaceMemberService, createWorkspaceService } from '#cloud/server/workspaces'
import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import type { Kysely } from 'kysely'

export type CloudServices = {
  config: CloudServerConfig
  database: Kysely<CloudDatabase>
  auth: CloudAuthAdapter
  objects: ObjectStore
  resolveIdentity?: CloudIdentityResolver
  resolveSession?: CloudSessionResolver
  /**
   * An approved account even before it accepted the current terms, for leaving: reading its
   * documents and deleting the account. Defaults to `resolveSession` when that is given.
   */
  resolveAccountSession?: CloudSessionResolver
  invitationDelivery?: InvitationDelivery
  invitationOutbox?: InvitationOutbox
  transactionalEmail?: TransactionalEmailService
  enrollment?: EnrollmentService
  entitlementSource?: EntitlementSource
  policy?: CloudPolicy
  /** The imported `servicesSigningKey`, required when the config names one. See `loadServicesSigningKey`. */
  servicesSigningKey?: ServicesSigningKey
  /**
   * Where clients reach this runtime's collaboration relay. Without one, Cloud rooms fall back to
   * peer-to-peer and writes are not enforced by the server.
   */
  relayURL?: string
  /** Ends a restored document's live rooms, on the relay this runtime runs, if any. */
  onDocumentRestored?: (documentId: string) => void
  /** Ends a taken-down document's live rooms, saving them for when it is restored. */
  onDocumentTakenDown?: (documentId: string) => void
  /** Tells a document's live rooms its version history changed, on the relay this runtime runs. */
  onDocumentVersionsChanged?: (documentId: string) => void
  /** Logs errors no route handled, and reports them when the deployment configures error tracking. */
  reportError?: CloudErrorReporter
  /** The request ID this runtime trusts from what stands in front of it, such as `cf-ray`. */
  forwardedRequestId?: ForwardedRequestId
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
  const resolveAccountSession =
    services.resolveAccountSession ??
    (services.resolveSession
      ? services.resolveSession
      : (request: Request) => services.auth.resolveAccountSession(request.headers))
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
      operations: createAdminOperationsService(services.database, services.config),
      documents: createAdminDocumentService(services.database, {
        closeRooms: services.onDocumentTakenDown,
        purgeGraceMs: services.config.documentPurgeGraceMs
      }),
      reports: createAdminReportService(services.database)
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
    onVersionsChanged: services.onDocumentVersionsChanged,
    trash: {
      retentionMs: services.config.documentRetentionMs,
      purgeGraceMs: services.config.documentPurgeGraceMs,
      leaseDurationMs: services.config.cleanupLeaseDurationMs,
      reportError: services.reportError
    },
    reportError: services.reportError
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
  if (services.config.servicesSigningKey && !services.servicesSigningKey) {
    throw new CloudConfigError('Services need the signing key imported by loadServicesSigningKey')
  }
  const servicesTokens = services.servicesSigningKey
    ? createServicesTokenService({
        database: services.database,
        policy,
        deploymentMode: services.config.deployment,
        issuer: new URL(services.config.publicURL).origin,
        signingKey: services.servicesSigningKey,
        lifetimeSeconds: services.config.servicesTokenLifetimeSeconds
      })
    : undefined

  const requireActiveSession = async (context: Context, next: () => Promise<void>) => {
    // A route that lets an account leave before accepting the terms named it already.
    if (context.get('actor')) return next()
    const actor = await resolveSession(context.req.raw)
    if (!actor) return context.json({ error: { code: 'unauthorized' as const } }, 401)
    context.set('actor', actor)
    return next()
  }
  /**
   * An account that may leave: one that has terms to accept can still download its documents and
   * delete itself, which nothing else lets it do until it accepts.
   */
  const requireAccountSession = async (context: Context, next: () => Promise<void>) => {
    const actor = await resolveAccountSession(context.req.raw)
    if (!actor) return context.json({ error: { code: 'unauthorized' as const } }, 401)
    context.set('actor', actor)
    return next()
  }
  /** Reading one document, which downloading everything before leaving needs, without the terms. */
  const allowLeavingRead = async (context: Context, next: () => Promise<void>) => {
    if (context.req.method === 'GET') {
      const actor = await resolveAccountSession(context.req.raw)
      if (actor) context.set('actor', actor)
    }
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
    terms: createTermsService(services.database, services.config),
    pictures,
    config: services.config,
    enrollment,
    workspaces,
    deletion: createAccountDeletionService(services.database),
    resolveIdentity,
    resolveSession,
    requireActiveSession,
    requireAccountSession,
    authenticatedMutationLimiter
  })
  const reports = createDocumentReportService(services.database, {
    sharing,
    email: services.transactionalEmail,
    adminRecipients: services.config.enrollmentAdminNotificationEmails,
    publicURL: services.config.publicURL
  })
  const cloudAPI = createCloudAPIRouter({
    collaboration,
    database: services.database,
    rateLimitSecret: services.config.authSecret,
    documents,
    versions,
    entitlements,
    servicesTokens,
    sharing,
    reports,
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
    reports,
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
    .onError(cloudErrorHandler(services.reportError))
    .use('*', cloudRequestId(services.forwardedRequestId))
    .use(CLOUD_DISCOVERY_PATH, cloudCORS)
    .use('/api/*', cloudCORS)
    .use(
      '/api/*',
      bodyLimit({
        maxSize: CLOUD_API_MAX_BODY_BYTES,
        onError: (context) => context.json({ error: { code: 'invalid_request' as const } }, 413)
      })
    )
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
    .get(CLOUD_SERVICES_JWKS_PATH, async (context) =>
      servicesTokens ? context.json(servicesTokens.jwks()) : context.notFound()
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
    .use('/api/documents/:documentId', allowLeavingRead)
    .use('/api/*', requireActiveSession)
    .route('/api/admin', admin)
    .use('/api/*', authenticatedMutationLimiter)
    .route('/api', cloudAPI)
}

export type CloudApp = ReturnType<typeof createCloudApp>
