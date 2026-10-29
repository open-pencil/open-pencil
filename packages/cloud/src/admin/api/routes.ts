import { requireTrustedMutationOrigin } from '#cloud/admin/api/security'
import type { AdminAuditService } from '#cloud/admin/audit/service'
import type { AdminEmailService } from '#cloud/admin/email/service'
import type { EnrollmentService } from '#cloud/admin/enrollment/service'
import { adminErrorStatus, AdminDomainError } from '#cloud/admin/errors'
import type { AdminOperationsService } from '#cloud/admin/operations/service'
import {
  enrollmentStatusSchema,
  parseEnrollmentReview,
  parseUserMutation,
  parseUserRoleMutation
} from '#cloud/admin/schema'
import type { AdminUserService } from '#cloud/admin/users/service'
import {
  cloudAdminAuditFilterSchema,
  cloudAdminEmailFilterSchema,
  cloudAdminUserFilterSchema
} from '#cloud/contract'
import type { CloudAPIEnvironment } from '#cloud/server/api'
import type { CloudAuthAdapter } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import { CLOUD_RATE_LIMITS, createActorRateLimiter } from '#cloud/server/rate-limit'
import { validatedJSON, validatedQuery } from '#cloud/server/validation'
import { Hono, type Context } from 'hono'
import { NoResultError, type Kysely } from 'kysely'
import * as v from 'valibot'

/**
 * A count from the query string; anything but digits, or a number too large to be exact, is a bad
 * request rather than a NaN or out-of-range query.
 */
const countSchema = v.optional(v.pipe(v.string(), v.digits(), v.toNumber(), v.safeInteger()))
/** What an admin list reads from its query string: a search, one of `filters`, and a page. */
function listQuery<const Filter extends string>(filters: v.PicklistSchema<Filter[], undefined>) {
  const schema = v.object({
    search: v.optional(v.string()),
    filter: v.optional(filters),
    limit: countSchema,
    offset: countSchema
  })
  return (input: unknown) => v.parse(schema, input)
}
const parseEnrollmentQuery = listQuery(enrollmentStatusSchema)
const parseUserQuery = listQuery(cloudAdminUserFilterSchema)
const parseEmailQuery = listQuery(cloudAdminEmailFilterSchema)
const parseAuditQuery = listQuery(cloudAdminAuditFilterSchema)
/** Accounts are named by UUID; anything else names no one, rather than failing the query. */
const accountIdSchema = v.pipe(v.string(), v.uuid())

/** Does what an administrator asked to another account; one that is not an account is not found. */
async function accountMutation(
  context: Context<CloudAPIEnvironment>,
  userId: string,
  mutate: (actorId: string, userId: string) => Promise<void>
) {
  if (!v.is(accountIdSchema, userId)) {
    return context.json({ error: { code: 'not_found' as const } }, 404)
  }
  await mutate(context.get('actor').userId, userId)
  return context.json({ ok: true as const })
}

export type CloudAdminServices = {
  email: AdminEmailService
  enrollment: EnrollmentService
  users: AdminUserService
  audit: AdminAuditService
  operations: AdminOperationsService
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
  return new Hono<CloudAPIEnvironment>()
    .use('*', requireTrustedMutationOrigin(trustedOrigins))
    .use('*', async (context, next) => {
      const actor = context.get('actor')
      if (actor.deploymentRole !== 'admin') {
        return context.json({ error: { code: 'forbidden' as const } }, 403)
      }
      if (security.requireMFA) {
        const status = await security.auth.mfaStatus(context.req.raw.headers)
        if (!status?.assured) {
          return context.json({ error: { code: 'mfa_required' as const } }, 403)
        }
      }
      return next()
    })
    .use('*', adminRead)
    .use('*', adminMutation)
    .onError((error, context) => {
      if (error instanceof AdminDomainError) {
        return context.json({ error: { code: error.code } }, adminErrorStatus(error))
      }
      if (error instanceof v.ValiError) {
        return context.json({ error: { code: 'invalid_request' as const } }, 400)
      }
      // An enrollment or message ID that names nothing.
      if (error instanceof NoResultError) {
        return context.json({ error: { code: 'not_found' as const } }, 404)
      }
      throw error
    })
    .get('/enrollments', validatedQuery(parseEnrollmentQuery), async (context) =>
      context.json(await services.enrollment.list(context.req.valid('query')))
    )
    .post('/enrollments/:id/approve', validatedJSON(parseEnrollmentReview), async (context) =>
      context.json({
        enrollment: await services.enrollment.review(
          context.get('actor').userId,
          context.req.param('id'),
          'approved',
          context.req.valid('json')
        )
      })
    )
    .post('/enrollments/:id/reject', validatedJSON(parseEnrollmentReview), async (context) =>
      context.json({
        enrollment: await services.enrollment.review(
          context.get('actor').userId,
          context.req.param('id'),
          'rejected',
          context.req.valid('json')
        )
      })
    )
    .post('/enrollments/:id/revoke', validatedJSON(parseEnrollmentReview), async (context) =>
      context.json({
        enrollment: await services.enrollment.review(
          context.get('actor').userId,
          context.req.param('id'),
          'revoked',
          context.req.valid('json')
        )
      })
    )
    .get('/users', validatedQuery(parseUserQuery), async (context) =>
      context.json(await services.users.list(context.req.valid('query')))
    )
    .get('/users/:id', async (context) => {
      const id = context.req.param('id')
      const detail = v.is(accountIdSchema, id) ? await services.users.detail(id) : null
      if (!detail) return context.json({ error: { code: 'not_found' as const } }, 404)
      return context.json(detail)
    })
    .post('/users/reset-two-step', validatedJSON(parseUserMutation), (context) =>
      accountMutation(context, context.req.valid('json').userId, (actorId, userId) =>
        services.users.resetTwoStep(actorId, userId)
      )
    )
    .post('/users/remove-picture', validatedJSON(parseUserMutation), (context) =>
      accountMutation(context, context.req.valid('json').userId, (actorId, userId) =>
        services.users.removePicture(actorId, userId)
      )
    )
    .post('/users/ban', validatedJSON(parseUserMutation), async (context) => {
      const input = context.req.valid('json')
      await services.users.ban(
        context.req.raw.headers,
        context.get('actor').userId,
        input.userId,
        input.reason
      )
      return context.json({ ok: true as const })
    })
    .post('/users/unban', validatedJSON(parseUserMutation), async (context) => {
      const input = context.req.valid('json')
      await services.users.unban(context.req.raw.headers, context.get('actor').userId, input.userId)
      return context.json({ ok: true as const })
    })
    .post('/users/revoke-sessions', validatedJSON(parseUserMutation), async (context) => {
      const input = context.req.valid('json')
      await services.users.revokeSessions(
        context.req.raw.headers,
        context.get('actor').userId,
        input.userId
      )
      return context.json({ ok: true as const })
    })
    .post('/users/set-admin', validatedJSON(parseUserRoleMutation), async (context) => {
      const input = context.req.valid('json')
      await services.users.setAdmin(
        context.req.raw.headers,
        context.get('actor').userId,
        input.userId,
        input.enabled
      )
      return context.json({ ok: true as const })
    })
    .get('/email', validatedQuery(parseEmailQuery), async (context) =>
      context.json(await services.email.list(context.req.valid('query')))
    )
    .post('/email/:id/regenerate', async (context) => {
      await services.email.regenerate(context.get('actor').userId, context.req.param('id'))
      return context.json({ ok: true as const })
    })
    .get('/audit', validatedQuery(parseAuditQuery), async (context) =>
      context.json(await services.audit.list(context.req.valid('query')))
    )
    .get('/operations', async (context) => context.json(await services.operations.summary()))
}

/** The administration routes' types, for the portal's typed client. */
export type CloudAdminRoutes = ReturnType<typeof createCloudAdminRoutes>
