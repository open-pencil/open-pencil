import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import {
  CLOUD_RATE_LIMITS,
  routeParamResource,
  createResourceRateLimiter
} from '#cloud/server/rate-limit'
import { Hono } from 'hono'
import type { Kysely } from 'kysely'

/**
 * The budget for inviting people to a document. The sharing routes themselves are the contract's
 * (`sharingContract`, `publicSharingContract`).
 */
export function createSharingRateLimits(rateLimit?: {
  database: Kysely<CloudDatabase>
  secret: string
}) {
  const router = new Hono<{ Variables: { actor: CloudActor } }>()
  if (rateLimit) {
    router.use(
      '/documents/:documentId/invitations',
      createResourceRateLimiter(
        rateLimit.database,
        rateLimit.secret,
        CLOUD_RATE_LIMITS.invitationMutation,
        routeParamResource('documentId'),
        (context) => context.req.method !== 'POST'
      )
    )
  }
  return router
}
