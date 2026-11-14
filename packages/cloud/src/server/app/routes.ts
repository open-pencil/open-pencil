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
import { createCloudAPIRouter, createPublicCloudAPIRouter } from '#cloud/server/api'
import { createAuthenticationEmailService } from '#cloud/server/auth'
import { createInternalRoutes, createInternalService } from '#cloud/server/internal'
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
  const { resolveIdentity, resolveSession } = resolvers
  const admin = createCloudAdminRoutes(
    {
      email: createAdminEmailService(database, services.transactionalEmail, {
        publicURL: config.publicURL
      }),
      enrollment: app.enrollment,
      users: createAdminUserService(database, services.auth, {
        requireMFA: config.deploymentAdminMFARequired,
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
        email: services.transactionalEmail,
        publicURL: config.publicURL,
        contactEmail: config.legal?.abuseEmail
      }),
      reports: createAdminReportService(database, {
        email: services.transactionalEmail,
        contactEmail: config.legal?.abuseEmail
      })
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
  const shared = {
    collaboration: app.collaboration,
    documents: app.documents,
    versions: app.versions,
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
  return { admin, account, accessTokens, cloudAPI, publicCloudAPI, internalAPI }
}
