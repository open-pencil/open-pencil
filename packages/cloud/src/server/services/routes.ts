import { parseCreateServicesToken } from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import { DocumentNotFoundError } from '#cloud/server/documents'
import { CLOUD_RATE_LIMITS, createRouteRateLimiter } from '#cloud/server/rate-limit'
import { validatedJSON } from '#cloud/server/validation'
import { Hono } from 'hono'
import type { Kysely } from 'kysely'

import { ServicesNotEntitledError } from './errors'
import type { ServicesTokenService } from './tokens'

export type ServicesRouteEnvironment = { Variables: { actor: CloudActor } }

/** Without a service, the deployment offers no services and the token route is not found. */
export function createServicesRoutes(
  service: ServicesTokenService | undefined,
  rateLimit?: { database: Kysely<CloudDatabase>; secret: string }
) {
  const router = new Hono<ServicesRouteEnvironment>()
  if (service && rateLimit) {
    router.use(
      '/services/token',
      createRouteRateLimiter(rateLimit.database, rateLimit.secret, CLOUD_RATE_LIMITS.servicesToken)
    )
  }
  return router.post(
    '/services/token',
    validatedJSON(parseCreateServicesToken),
    async (context) => {
      if (!service) return context.json({ error: { code: 'not_found' as const } }, 404)
      try {
        return context.json(
          await service.issue(context.get('actor'), context.req.valid('json').workspaceId)
        )
      } catch (error) {
        if (error instanceof DocumentNotFoundError) {
          return context.json({ error: { code: 'not_found' as const } }, 404)
        }
        if (error instanceof ServicesNotEntitledError) {
          return context.json({ error: { code: 'forbidden' as const } }, 403)
        }
        throw error
      }
    }
  )
}
