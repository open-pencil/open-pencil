import { internalContract } from '#cloud/contract'
import { contractRoutes } from '#cloud/server/api/contract'
import { capabilityHashMatches, hashCapability } from '#cloud/server/sharing/crypto'
import { implement } from '@orpc/server'
import { Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'

import type { InternalService } from './service'

/** What a caller's token may do: everything the internal API offers, or read usage counts only. */
type InternalScope = 'service' | 'usage'

/** The internal API's routes, as the contract describes them. */
function createInternalProcedures(service: InternalService) {
  const routes = implement(internalContract).$context<{ scope: InternalScope }>()
  return routes.router({
    setAccountEntitlements: routes.setAccountEntitlements.handler(
      async ({ input, context, errors }) => {
        if (context.scope !== 'service') throw errors.unauthorized()
        const result = await service.setAccountEntitlements(input.params.userId, input.body)
        if (!result.found) throw errors.not_found()
        return { applied: result.applied }
      }
    ),
    accountSeats: routes.accountSeats.handler(async ({ input, context, errors }) => {
      if (context.scope !== 'service') throw errors.unauthorized()
      const seats = await service.accountSeats(input.params.userId)
      if (seats === null) throw errors.not_found()
      return { seats }
    }),
    // Either token reads usage: it is counts only.
    dailyUsage: routes.dailyUsage.handler(({ input }) => service.dailyUsage(input.query))
  })
}

/**
 * The internal API on HTTP, for runtimes without a private transport to their services. The
 * service token reaches every route; the usage token, for the operator's dashboard, only usage.
 */
export function createInternalRoutes(
  service: InternalService,
  tokens: { serviceToken?: string; usageToken?: string }
) {
  const scopes: [InternalScope, string | undefined][] = [
    ['service', tokens.serviceToken],
    ['usage', tokens.usageToken]
  ]
  const digests = scopes.flatMap(([scope, token]) =>
    token ? [{ scope, digest: hashCapability(token) }] : []
  )
  // What each request's token may do, read back when its procedure runs.
  const scopeOf = new WeakMap<Request, InternalScope>()
  const unauthorized = { error: { code: 'unauthorized' as const } }
  return new Hono()
    .use(
      '*',
      bearerAuth({
        verifyToken: (token, c) => {
          const match = digests.find(({ digest }) => capabilityHashMatches(digest, token))
          if (match) scopeOf.set(c.req.raw, match.scope)
          return match !== undefined
        },
        noAuthenticationHeader: { message: unauthorized },
        invalidAuthenticationHeader: { message: unauthorized },
        invalidToken: { message: unauthorized }
      })
    )
    .use(
      '*',
      contractRoutes(createInternalProcedures(service), (c) => ({
        // Only a request bearerAuth let through gets here, so its scope was recorded.
        scope: scopeOf.get(c.req.raw) ?? 'usage'
      }))
    )
}
