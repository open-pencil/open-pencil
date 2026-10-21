import { parseCreateAIToken } from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import { DocumentNotFoundError } from '#cloud/server/documents'
import { CLOUD_RATE_LIMITS, createActorRateLimiter } from '#cloud/server/rate-limit'
import { validatedJSON } from '#cloud/server/validation'
import { Hono } from 'hono'
import type { Kysely } from 'kysely'

import { AINotEntitledError } from './errors'
import type { AITokenService } from './service'

export type AIRouteEnvironment = { Variables: { actor: CloudActor } }

/** Without a service, the deployment has no AI service and the token route is not found. */
export function createAIRoutes(
  service: AITokenService | undefined,
  rateLimit?: { database: Kysely<CloudDatabase>; secret: string }
) {
  const router = new Hono<AIRouteEnvironment>()
  if (service && rateLimit) {
    router.use(
      '/ai/token',
      createActorRateLimiter(rateLimit.database, rateLimit.secret, CLOUD_RATE_LIMITS.aiToken)
    )
  }
  return router.post('/ai/token', validatedJSON(parseCreateAIToken), async (context) => {
    if (!service) return context.json({ error: { code: 'not_found' as const } }, 404)
    try {
      return context.json(
        await service.issue(context.get('actor'), context.req.valid('json').workspaceId)
      )
    } catch (error) {
      if (error instanceof DocumentNotFoundError) {
        return context.json({ error: { code: 'not_found' as const } }, 404)
      }
      if (error instanceof AINotEntitledError) {
        return context.json({ error: { code: 'forbidden' as const } }, 403)
      }
      throw error
    }
  })
}
