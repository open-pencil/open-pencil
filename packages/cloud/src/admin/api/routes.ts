import { requireTrustedMutationOrigin } from '#cloud/admin/api/security'
import type { AdminAuditService } from '#cloud/admin/audit/service'
import type { AdminDocumentService } from '#cloud/admin/documents/service'
import type { AdminEmailService } from '#cloud/admin/email/service'
import type { EnrollmentService } from '#cloud/admin/enrollment/service'
import { AdminDomainError } from '#cloud/admin/errors'
import type { AdminOperationsService } from '#cloud/admin/operations/service'
import type { AdminReportService } from '#cloud/admin/reports/service'
import type { AdminUserService } from '#cloud/admin/users/service'
import { CLOUD_API_ERROR_STATUS } from '#cloud/contract'
import type { CloudAPIEnvironment } from '#cloud/server/api'
import { contractRoutes } from '#cloud/server/api/contract'
import type { CloudAuthAdapter } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import { DocumentNotFoundError } from '#cloud/server/documents/errors'
import { CLOUD_RATE_LIMITS, createActorRateLimiter } from '#cloud/server/rate-limit'
import { documentRevisionParams } from '#cloud/server/validation'
import { Hono, type Context } from 'hono'
import { NoResultError, type Kysely } from 'kysely'
import * as v from 'valibot'

import { createAdminProcedures } from './procedures'

export type CloudAdminServices = {
  email: AdminEmailService
  enrollment: EnrollmentService
  users: AdminUserService
  audit: AdminAuditService
  operations: AdminOperationsService
  documents: AdminDocumentService
  reports: AdminReportService
}

export function createCloudAdminRoutes(
  services: CloudAdminServices,
  trustedOrigins: ReadonlySet<string>,
  security: {
    auth: CloudAuthAdapter
    database: Kysely<CloudDatabase>
    requireMFA: boolean
    secret: string
  }
) {
  const adminRead = createActorRateLimiter(
    security.database,
    security.secret,
    CLOUD_RATE_LIMITS.adminRead,
    (context) => context.req.method !== 'GET'
  )
  const adminMutation = createActorRateLimiter(
    security.database,
    security.secret,
    CLOUD_RATE_LIMITS.adminMutation,
    (context) => context.req.method === 'GET'
  )
  return (
    new Hono<CloudAPIEnvironment>()
      .use('*', requireTrustedMutationOrigin(trustedOrigins))
      .use('*', async (context, next) => {
        const actor = context.get('actor')
        if (actor.deploymentRole !== 'admin') {
          return context.json({ error: { code: 'forbidden' as const } }, 403)
        }
        if (security.requireMFA) {
          const status = await security.auth.mfaStatus(context.req.raw.headers)
          if (!status?.assured) {
            // Someone with two-step only has to prove it again; someone without has to turn it on.
            const code = status?.enabled ? 'two_step_unconfirmed' : 'mfa_required'
            return context.json({ error: { code } }, 403)
          }
        }
        return next()
      })
      .use('*', adminRead)
      .use('*', adminMutation)
      .onError((error, context) => {
        if (error instanceof AdminDomainError) {
          return context.json({ error: { code: error.code } }, CLOUD_API_ERROR_STATUS[error.code])
        }
        if (error instanceof v.ValiError) {
          return context.json({ error: { code: 'invalid_request' as const } }, 400)
        }
        // An enrollment or message ID that names nothing, or a document with nothing saved.
        if (error instanceof NoResultError || error instanceof DocumentNotFoundError) {
          return context.json({ error: { code: 'not_found' as const } }, 404)
        }
        throw error
      })
      // Its address names the revision it shows, which is also its ETag. The browser asks again
      // each time, so the administrator and two-step checks always run, even for another account
      // later in the same browser; an unchanged thumbnail answers 304 without reading storage.
      .get(
        '/documents/:documentId/thumbnails/:revisionId',
        documentRevisionParams,
        async (context) => {
          const { documentId, revisionId } = context.req.valid('param')
          const etag = `"${revisionId}"`
          context.header('Cache-Control', 'private, no-cache')
          context.header('ETag', etag)
          if (
            context.req.header('If-None-Match') === etag &&
            (await services.documents.isCurrentRevision(documentId, revisionId))
          ) {
            return context.body(null, 304)
          }
          const thumbnail = await services.documents.thumbnail(documentId, revisionId)
          if (!thumbnail) return context.json({ error: { code: 'not_found' as const } }, 404)
          context.header('Content-Type', 'image/png')
          context.header('X-Content-Type-Options', 'nosniff')
          context.header('Content-Security-Policy', "default-src 'none'; sandbox")
          return context.body(new Uint8Array(thumbnail))
        }
      )
      // Every other route is the contract's (`adminContract`), behind the checks above.
      .use(
        '*',
        contractRoutes(
          createAdminProcedures(services),
          (context: Context<CloudAPIEnvironment>) => ({
            actor: context.get('actor'),
            request: context.req.raw
          })
        )
      )
  )
}

/** The administration routes' types, for the portal's typed client. */
export type CloudAdminRoutes = ReturnType<typeof createCloudAdminRoutes>
