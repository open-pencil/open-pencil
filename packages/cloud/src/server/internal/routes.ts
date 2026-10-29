import { capabilityHashMatches, hashCapability } from '#cloud/server/sharing/crypto'
import { validatedJSON } from '#cloud/server/validation'
import { Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'
import * as v from 'valibot'

import { parseSetWorkspaceEntitlements, type InternalService } from './service'

const uuidSchema = v.pipe(v.string(), v.uuid())

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
      '/workspaces/:workspaceId/entitlements',
      validatedJSON(parseSetWorkspaceEntitlements),
      async (context) => {
        const workspaceId = context.req.param('workspaceId')
        if (!v.is(uuidSchema, workspaceId)) {
          return context.json({ error: { code: 'not_found' as const } }, 404)
        }
        const result = await service.setWorkspaceEntitlements(
          workspaceId,
          context.req.valid('json')
        )
        if (!result.found) return context.json({ error: { code: 'not_found' as const } }, 404)
        return context.json({ applied: result.applied })
      }
    )
}
