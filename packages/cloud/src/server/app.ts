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
  CLOUD_DISCOVERY_PATH,
  CLOUD_PROTOCOL_VERSION,
  parseCloudPasswordChange,
  parseCloudSocialLink,
  parseCloudUnlinkAuthenticationMethod,
  type AccountSecurityErrorCode,
  type CloudDiscovery
} from '#cloud/contract'
import {
  createCloudAPIRouter,
  createPublicCloudAPIRouter,
  type CloudAPIEnvironment
} from '#cloud/server/api'
import {
  createAccountAuthenticationService,
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
import { validatedJSON } from '#cloud/server/validation'
import { createWorkspaceService } from '#cloud/server/workspaces'
import { APIError } from 'better-auth'
import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import type { Kysely } from 'kysely'

const ACCOUNT_SECURITY_ERROR_CODES: Record<string, AccountSecurityErrorCode> = {
  INVALID_PASSWORD: 'current_password_invalid',
  PASSWORD_TOO_SHORT: 'password_too_short',
  PASSWORD_TOO_LONG: 'password_too_long',
  FAILED_TO_UNLINK_LAST_ACCOUNT: 'last_authentication_method',
  SESSION_NOT_FRESH: 'session_not_fresh'
}

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

const ACTIVE_ACCOUNT_AUTH_PATHS = new Set([
  '/api/auth/account-info',
  '/api/auth/change-email',
  '/api/auth/change-password',
  '/api/auth/delete-user',
  '/api/auth/get-access-token',
  '/api/auth/link-social',
  '/api/auth/list-accounts',
  '/api/auth/list-sessions',
  '/api/auth/refresh-token',
  '/api/auth/revoke-other-sessions',
  '/api/auth/revoke-session',
  '/api/auth/revoke-sessions',
  '/api/auth/unlink-account'
])

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

  const accountAuthentication = createAccountAuthenticationService(services.auth, services.config)
  const accountAction = async <Value>(operation: () => Promise<Value>, context: Context) => {
    try {
      return await operation()
    } catch (error) {
      if (error instanceof APIError) {
        return context.json(
          {
            error: {
              code:
                ACCOUNT_SECURITY_ERROR_CODES[error.body?.code ?? ''] ??
                'authentication_method_failed'
            }
          },
          error.statusCode as 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500
        )
      }
      throw error
    }
  }
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
    .on(['GET', 'POST'], '/api/auth/*', async (context) => {
      if (
        ACTIVE_ACCOUNT_AUTH_PATHS.has(context.req.path) &&
        !(await resolveSession(context.req.raw))
      ) {
        return context.json({ error: { code: 'unauthorized' as const } }, 401)
      }
      return services.auth.handler(context.req.raw)
    })
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
    .use('/api/account/authentication/*', requireActiveSession)
    .use('/api/account/authentication/*', authenticatedMutationLimiter)
    .post(
      '/api/account/authentication/change-password',
      validatedJSON(parseCloudPasswordChange),
      async (context) => {
        const result = await accountAction(
          () =>
            accountAuthentication.changePassword(
              context.req.raw.headers,
              context.req.valid('json')
            ),
          context
        )
        return result instanceof Response ? result : context.json({ ok: true as const })
      }
    )
    .post(
      '/api/account/authentication/link-social',
      validatedJSON(parseCloudSocialLink),
      async (context) => {
        const result = await accountAction(
          () =>
            accountAuthentication.startSocialLink(
              context.req.raw.headers,
              context.req.valid('json')
            ),
          context
        )
        return result instanceof Response ? result : context.json({ url: result })
      }
    )
    .post(
      '/api/account/authentication/unlink',
      validatedJSON(parseCloudUnlinkAuthenticationMethod),
      async (context) => {
        const result = await accountAction(
          () =>
            accountAuthentication.unlink(
              context.req.raw.headers,
              context.req.valid('json').methodId
            ),
          context
        )
        return result instanceof Response ? result : context.json({ ok: true as const })
      }
    )
    .get('/api/account/authentication', async (context) => {
      const result = await accountAction(
        () => accountAuthentication.methods(context.req.raw.headers),
        context
      )
      return result instanceof Response ? result : context.json(result)
    })
    .use('/api/public/shares/:shareId/collaboration-ticket', publicCollaborationLimiter)
    .use('/api/public/*', publicRateLimiter)
    .use('/api/shares/*', publicRateLimiter)
    .use('/api/invitations/*', publicRateLimiter)
    .route('/api', publicCloudAPI)
    .use('/api/*', requireActiveSession)
    .route('/api/admin', admin)
    .use('/api/*', authenticatedMutationLimiter)
    .route('/api', cloudAPI)
}

export type CloudApp = ReturnType<typeof createCloudApp>
