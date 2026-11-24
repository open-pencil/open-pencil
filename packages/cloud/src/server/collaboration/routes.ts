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
 * The budget for joining a document's live room. The ticket routes themselves are the contract's
 * (`sharingContract.collaborationTicket`, `publicSharingContract.collaborationTicket`).
 */
export function createCollaborationRateLimits(rateLimit?: {
  database: Kysely<CloudDatabase>
  secret: string
}) {
  const router = new Hono<{ Variables: { actor: CloudActor } }>()
  if (rateLimit) {
    router.use(
      '/documents/:documentId/collaboration-ticket',
      createResourceRateLimiter(
        rateLimit.database,
        rateLimit.secret,
        CLOUD_RATE_LIMITS.collaborationTicket,
        routeParamResource('documentId')
      )
    )
  }
  return router
}
