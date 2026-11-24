import {
  createAdminAuditService,
  createAdminDocumentService,
  createAdminEmailService,
  createAdminOperationsService,
  createAdminReportService,
  createAdminUserService,
  createCloudAdminRoutes
} from '#cloud/admin'
import { createAccountDeletionService } from '#cloud/server/account/deletion'
import { createAccountRoutes } from '#cloud/server/account/routes'
import { createTermsService } from '#cloud/server/account/terms'
import { createAccessTokenRoutes } from '#cloud/server/account/tokens'
import {
  createCloudAPIRouter,
  createPublicCloudAPIRouter,
  type CloudAPIEnvironment
} from '#cloud/server/api'
import { createAuthenticationEmailService } from '#cloud/server/auth'
import { signInProviders } from '#cloud/server/auth/methods'
import { createInternalRoutes, createInternalService } from '#cloud/server/internal'
import {
  createAgentPairingGrants,
  createOAuthRoutes,
  createOAuthService
} from '#cloud/server/oauth'
import { Hono } from 'hono'

import type { createRequestChecks, createRequestResolvers } from './checks'
import type { createAppRateLimiters } from './limiters'
import type { CloudAppServices, CloudServices } from './services'

/** The routers the app mounts, each over the services, checks, and limiters it needs. */
export function createAppRouters(
  services: CloudServices,
  app: CloudAppServices,
  resolvers: ReturnType<typeof createRequestResolvers>,
  checks: ReturnType<typeof createRequestChecks>,
  limiters: ReturnType<typeof createAppRateLimiters>,
  allowedOrigins: ReadonlySet<string>
) {
  const { config, database } = services
  const { resolveIdentity, resolveSession, twoStepConfirmed } = resolvers
  const admin = createCloudAdminRoutes(
    {
      email: createAdminEmailService(database, services.transactionalEmail, {
        publicURL: config.publicURL
      }),
      enrollment: app.enrollment,
      users: createAdminUserService(database, services.auth, {
        requireMFA: config.deploymentAdminMFARequired,
        approval: config.enrollmentMode === 'approval',
        signInProviders: signInProviders(config),
        pictures: app.pictures,
        notify: services.transactionalEmail
          ? createAuthenticationEmailService(services.transactionalEmail, config.publicURL)
          : undefined
      }),
      audit: createAdminAuditService(database),
      operations: createAdminOperationsService(database, config),
      documents: createAdminDocumentService(database, {
        closeRooms: services.onDocumentTakenDown,
        purgeGraceMs: config.documentPurgeGraceMs,
        communityWorkspaceId: config.community?.workspaceId ?? null,
        objects: services.objects,
        documents: app.documents,
        email: services.transactionalEmail,
        publicURL: config.publicURL,
        contactEmail: config.legal?.abuseEmail
      }),
      reports: createAdminReportService(
        database,
        { email: services.transactionalEmail, contactEmail: config.legal?.abuseEmail },
        { communityWorkspaceId: config.community?.workspaceId ?? null }
      )
    },
    allowedOrigins,
    {
      database,
      secret: config.authSecret,
      auth: services.auth,
      requireMFA: config.deploymentAdminMFARequired
    }
  )
  const account = createAccountRoutes({
    auth: services.auth,
    terms: createTermsService(database, config),
    pictures: app.pictures,
    config,
    enrollment: app.enrollment,
    workspaces: app.workspaces,
    deletion: createAccountDeletionService(database),
    resolveIdentity,
    resolveSession,
    twoStepConfirmed,
    requireActiveSession: checks.requireActiveSession,
    requireAccountSession: checks.requireAccountSession,
    authenticatedMutationLimiter: limiters.authenticatedMutationLimiter
  })
  const accessTokens = createAccessTokenRoutes({
    auth: services.auth,
    resolveSession,
    requireActiveSession: checks.requireActiveSession,
    authenticatedMutationLimiter: limiters.authenticatedMutationLimiter
  })
  const oauth = services.auth.oauth
  const appConnections = oauth
    ? createOAuthRoutes({
        publicURL: config.publicURL,
        service: createOAuthService({
          database,
          publicURL: config.publicURL,
          secret: config.authSecret,
          steps: oauth.steps
        }),
        pairing: services.callPairedTool
          ? createAgentPairingGrants({
              database,
              publicURL: config.publicURL,
              issuer: new URL('/api/auth', config.publicURL).href,
              secret: config.authSecret
            })
          : undefined,
        publicRateLimiter: limiters.agentPairingPageLimiter,
        serverMetadata: oauth.serverMetadata,
        requireActiveSession: checks.requireActiveSession,
        authenticatedMutationLimiter: limiters.authenticatedMutationLimiter
      })
    : new Hono<CloudAPIEnvironment>()
  const shared = {
    collaboration: app.collaboration,
    documents: app.documents,
    documentTools: app.documentTools,
    versions: app.versions,
    comments: app.comments,
    community: app.community,
    entitlements: app.entitlements,
    sharing: app.sharing,
    reports: app.reports,
    workspaces: app.workspaces,
    workspaceMembers: app.workspaceMembers,
    resolveSession
  }
  const cloudAPI = createCloudAPIRouter({
    ...shared,
    database,
    rateLimitSecret: config.authSecret,
    servicesTokens: app.servicesTokens,
    billingTokens: app.billingTokens
  })
  const publicCloudAPI = createPublicCloudAPIRouter(shared)
  // Services such as billing authenticate with their own token, not a session.
  const internalAPI = config.internalServiceToken
    ? createInternalRoutes(createInternalService(database), config.internalServiceToken)
    : new Hono()
  return { admin, account, accessTokens, appConnections, cloudAPI, publicCloudAPI, internalAPI }
}
