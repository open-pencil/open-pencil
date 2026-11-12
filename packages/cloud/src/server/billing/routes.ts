import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import { CLOUD_RATE_LIMITS, createRouteRateLimiter } from '#cloud/server/rate-limit'
import { Hono } from 'hono'
import type { Kysely } from 'kysely'

import type { BillingTokenService } from './tokens'

export type BillingRouteEnvironment = { Variables: { actor: CloudActor } }

/** Without a billing service, the deployment sells nothing and the token route is not found. */
export function createBillingRoutes(
  service: BillingTokenService | undefined,
  rateLimit?: { database: Kysely<CloudDatabase>; secret: string }
) {
  const router = new Hono<BillingRouteEnvironment>()
  if (service && rateLimit) {
    router.use(
      '/billing/token',
      createRouteRateLimiter(rateLimit.database, rateLimit.secret, CLOUD_RATE_LIMITS.billingToken)
    )
  }
  return router.post('/billing/token', async (context) => {
    if (!service) return context.json({ error: { code: 'not_found' as const } }, 404)
    return context.json(await service.issue(context.get('actor')))
  })
}
