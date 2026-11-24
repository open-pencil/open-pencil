import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import {
  CLOUD_RATE_LIMITS,
  createRouteRateLimiter,
  routeParamResource,
  createResourceRateLimiter
} from '#cloud/server/rate-limit'
import { Hono } from 'hono'
import type { Kysely } from 'kysely'

/**
 * The budgets for creating workspaces and inviting people to them. The workspace routes themselves
 * are the contract's (`workspacesContract`).
 */
export function createWorkspaceRateLimits(rateLimit?: {
  database: Kysely<CloudDatabase>
  secret: string
}) {
  const router = new Hono<{ Variables: { actor: CloudActor } }>()
  if (rateLimit) {
    router.use(
      '/',
      createRouteRateLimiter(
        rateLimit.database,
        rateLimit.secret,
        CLOUD_RATE_LIMITS.workspaceCreation,
        (context) => context.req.method !== 'POST'
      )
    )
    // Resending mails the invitation again, so it counts against the same budget as sending.
    router.use(
      '/:workspaceId/invitations/:invitationId/resend',
      createResourceRateLimiter(
        rateLimit.database,
        rateLimit.secret,
        CLOUD_RATE_LIMITS.invitationMutation,
        routeParamResource('workspaceId'),
        () => false
      )
    )
    router.use(
      '/:workspaceId/invitations',
      createResourceRateLimiter(
        rateLimit.database,
        rateLimit.secret,
        CLOUD_RATE_LIMITS.invitationMutation,
        routeParamResource('workspaceId'),
        (context) => context.req.method !== 'POST'
      )
    )
  }
  return router
}
