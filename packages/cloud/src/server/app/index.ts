import {
  CLOUD_API_MAX_BODY_BYTES,
  CLOUD_DISCOVERY_PATH,
  CLOUD_PROTOCOL_VERSION,
  CLOUD_SERVICES_JWKS_PATH
} from '#cloud/contract'
import type { CloudAPIEnvironment } from '#cloud/server/api'
import { AUTH_BASE_PATH } from '#cloud/server/auth'
import { createCommunityThumbnailRoutes } from '#cloud/server/community'
import { cloudDiscoveryFromConfig } from '#cloud/server/config'
import { cloudErrorHandler, reportCloudError } from '#cloud/server/errors'
import { cloudRequestId } from '#cloud/server/logging'
import { createMCPRoutes } from '#cloud/server/mcp'
import { createPictureRoutes } from '#cloud/server/pictures'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'

import { createRequestChecks, createRequestResolvers } from './checks'
import { createCloudCORS } from './cors'
import { requireMinimumEditor } from './editors'
import { robotsText, shouldPreventIndexing } from './indexing'
import { createAppRateLimiters } from './limiters'
import { createAppRouters } from './routes'
import { createAppServices, type CloudServices } from './services'

export { shouldPreventIndexing, withIndexingPolicy } from './indexing'
export type { CloudServices } from './services'

/** Where administration is mounted. */
const ADMIN_API_PATH = '/api/admin'

/**
 * The Cloud server over a runtime's services. The order the routes and checks are registered in
 * is what guards them: rate limiters come before the routes they count, the public API before
 * the checks that require an account, and administration before the general write limiter.
 */
export function createCloudApp(services: CloudServices) {
  const { config } = services
  const discovery = cloudDiscoveryFromConfig(config)
  const allowedOrigins = new Set(
    [config.publicURL, ...config.trustedOrigins].map((origin) => new URL(origin).origin)
  )
  // Billing's pages sign a visitor in with their Cloud session as they open (`CLOUD_BILLING_TOKEN_PATH`).
  const billingOrigin = config.billingEndpoint && new URL(config.billingEndpoint).origin
  const cloudCORS = createCloudCORS(allowedOrigins, billingOrigin || undefined)
  const app = createAppServices(services)
  const resolvers = createRequestResolvers(services)
  const checks = createRequestChecks(services, resolvers)
  const limiters = createAppRateLimiters(services.database, config)
  const routers = createAppRouters(services, app, resolvers, checks, limiters, allowedOrigins)
  // Apps reach the MCP endpoint where they may connect; its tools call this app with their token.
  const mcp = services.auth.oauth
    ? createMCPRoutes({
        publicURL: config.publicURL,
        fetchAPI: (request: Request): Response | Promise<Response> => cloudApp.fetch(request),
        onError: (error) =>
          void reportCloudError(services.reportError, 'MCP request failed', error, {
            source: 'request'
          })
      })
    : new Hono<CloudAPIEnvironment>()

  const cloudApp = new Hono<CloudAPIEnvironment>()
    .onError(cloudErrorHandler(services.reportError))
    .use('*', cloudRequestId(services.forwardedRequestId))
    // Discovery is public, so any editor's page may read it without credentials: an editor on
    // another address learns whether the server lists it before it signs in.
    .use(CLOUD_DISCOVERY_PATH, cloudCORS)
    .use('/api/*', cloudCORS)
    .use('/api/*', requireMinimumEditor(config.minimumEditorVersion))
    .use(
      '/api/*',
      bodyLimit({
        maxSize: CLOUD_API_MAX_BODY_BYTES,
        onError: (context) => context.json({ error: { code: 'invalid_request' as const } }, 413)
      })
    )
    .use('*', async (context, next) => {
      await next()
      if (shouldPreventIndexing(context.req.path, config.indexingPolicy)) {
        context.header('X-Robots-Tag', 'noindex, nofollow, noarchive')
      }
    })
    .get('/robots.txt', (context) => {
      context.header('Content-Type', 'text/plain; charset=utf-8')
      return context.body(
        robotsText(config.indexingPolicy, app.community.enabled ? config.publicURL : null)
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
      app.servicesTokens ? context.json(app.servicesTokens.jwks()) : context.notFound()
    )
    .on(['GET', 'POST'], `${AUTH_BASE_PATH}/*`, (context) => services.auth.handler(context.req.raw))
    .route('/', routers.account)
    .route('/', routers.accessTokens)
    .route('/', routers.appConnections)
    .route('/', mcp)
    .route('/', createPictureRoutes(app.pictures))
    .use('/api/shares/:shareId/collaboration-ticket', limiters.publicCollaborationLimiter)
    .use('/api/public/*', limiters.publicRateLimiter)
    .use('/api/shares/*', limiters.publicRateLimiter)
    .use('/api/invitations/*', limiters.publicRateLimiter)
    .use('/api/community/*', limiters.communityLimiter, limiters.publicRateLimiter)
    .route('/', createCommunityThumbnailRoutes(app.community))
    .route('/api', routers.publicCloudAPI)
    .route('/api/internal', routers.internalAPI)
    .use('/api/documents/:documentId', checks.allowLeavingRead)
    .use('/api/*', checks.requireActiveActor)
    .route(ADMIN_API_PATH, routers.admin)
    .use('/api/*', limiters.authenticatedMutationLimiter)
    .route('/api', routers.cloudAPI)
  return cloudApp
}

export type CloudApp = ReturnType<typeof createCloudApp>
