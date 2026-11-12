import { capabilityHashMatches, hashCapability } from '#cloud/server/sharing/crypto'
import { accountParams, validatedJSON } from '#cloud/server/validation'
import { Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'

import { parseSetAccountEntitlements, type InternalService } from './service'

/** The internal API on HTTP, for runtimes without a private transport to their services. */
export function createInternalRoutes(service: InternalService, serviceToken: string) {
  const digest = hashCapability(serviceToken)
  const unauthorized = { error: { code: 'unauthorized' as const } }
  return new Hono()
    .use(
      '*',
      bearerAuth({
        verifyToken: (token) => capabilityHashMatches(digest, token),
        noAuthenticationHeader: { message: unauthorized },
        invalidAuthenticationHeader: { message: unauthorized },
        invalidToken: { message: unauthorized }
      })
    )
    .put(
      '/accounts/:userId/entitlements',
      accountParams,
      validatedJSON(parseSetAccountEntitlements),
      async (context) => {
        const { userId } = context.req.valid('param')
        const result = await service.setAccountEntitlements(userId, context.req.valid('json'))
        if (!result.found) return context.json({ error: { code: 'not_found' as const } }, 404)
        return context.json({ applied: result.applied })
      }
    )
}
