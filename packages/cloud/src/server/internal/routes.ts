import { internalContract } from '#cloud/contract'
import { contractRoutes } from '#cloud/server/api/contract'
import { capabilityHashMatches, hashCapability } from '#cloud/server/sharing/crypto'
import { implement } from '@orpc/server'
import { Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'

import type { InternalService } from './service'

/** The internal API's routes, as the contract describes them. */
function createInternalProcedures(service: InternalService) {
  const routes = implement(internalContract)
  return routes.router({
    setAccountEntitlements: routes.setAccountEntitlements.handler(async ({ input, errors }) => {
      const result = await service.setAccountEntitlements(input.params.userId, input.body)
      if (!result.found) throw errors.not_found()
      return { applied: result.applied }
    }),
    accountSeats: routes.accountSeats.handler(async ({ input, errors }) => {
      const seats = await service.accountSeats(input.params.userId)
      if (seats === null) throw errors.not_found()
      return { seats }
    })
  })
}

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
    .use(
      '*',
      contractRoutes(createInternalProcedures(service), () => ({}))
    )
}
