import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import { CLOUD_RATE_LIMITS, createRouteRateLimiter } from '#cloud/server/rate-limit'
import { Hono } from 'hono'
import type { Kysely } from 'kysely'

import type { BillingTokenService } from './tokens'

/** The budget for asking for billing tokens, where the deployment sells anything at all. */
export function createBillingRateLimits(
  service: BillingTokenService | undefined,
  rateLimit?: { database: Kysely<CloudDatabase>; secret: string }
) {
  const router = new Hono<{ Variables: { actor: CloudActor } }>()
  if (service && rateLimit) {
    router.use(
      '/billing/token',
      createRouteRateLimiter(rateLimit.database, rateLimit.secret, CLOUD_RATE_LIMITS.billingToken)
    )
  }
  return router
}
