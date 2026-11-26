import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import { CLOUD_RATE_LIMITS, createRouteRateLimiter } from '#cloud/server/rate-limit'
import { Hono } from 'hono'
import type { Kysely } from 'kysely'

import type { ServicesTokenService } from './tokens'

/** The budget for asking for services tokens, where the deployment offers services at all. */
export function createServicesRateLimits(
  service: ServicesTokenService | undefined,
  rateLimit?: { database: Kysely<CloudDatabase>; secret: string }
) {
  const router = new Hono<{ Variables: { actor: CloudActor } }>()
  if (service && rateLimit) {
    router.use(
      '/services/token',
      createRouteRateLimiter(rateLimit.database, rateLimit.secret, CLOUD_RATE_LIMITS.servicesToken)
    )
  }
  return router
}
