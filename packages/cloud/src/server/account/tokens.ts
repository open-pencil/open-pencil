import { parseCloudAccessTokenCreate, parseCloudAccessTokenRevoke } from '#cloud/contract'
import type { CloudAPIEnvironment } from '#cloud/server/api'
import type { CloudAuthAdapter, CloudSessionResolver } from '#cloud/server/auth'
import { validatedJSON } from '#cloud/server/validation'
import { Hono, type MiddlewareHandler } from 'hono'

import { createAccountActions } from './actions'

export type AccessTokenRouteDependencies = {
  auth: CloudAuthAdapter
  resolveSession: CloudSessionResolver
  /** A session's, never a token's: account routes resolve sessions alone. */
  requireActiveSession: MiddlewareHandler<CloudAPIEnvironment>
  authenticatedMutationLimiter: MiddlewareHandler<CloudAPIEnvironment>
}

/**
 * The account's personal access tokens: listed, made, and revoked from a signed-in session only,
 * so a token never sees or makes others. Making one needs a recent sign-in.
 */
export function createAccessTokenRoutes(services: AccessTokenRouteDependencies) {
  const { accountAction } = createAccountActions(services.resolveSession)
  return new Hono<CloudAPIEnvironment>()
    .use('/api/account/tokens', services.requireActiveSession)
    .use('/api/account/tokens/*', services.requireActiveSession)
    .use('/api/account/tokens/*', services.authenticatedMutationLimiter)
    .get('/api/account/tokens', async (context) => {
      const tokens = await services.auth.listAccessTokens(context.req.raw.headers)
      if (!tokens) return context.json({ error: { code: 'unauthorized' as const } }, 401)
      return context.json({ tokens })
    })
    .post(
      '/api/account/tokens/create',
      validatedJSON(parseCloudAccessTokenCreate),
      async (context) => {
        const result = await accountAction(
          () => services.auth.createAccessToken(context.req.raw.headers, context.req.valid('json')),
          context
        )
        return result instanceof Response ? result : context.json(result, 201)
      }
    )
    .post(
      '/api/account/tokens/revoke',
      validatedJSON(parseCloudAccessTokenRevoke),
      async (context) => {
        const result = await accountAction(
          () =>
            services.auth.revokeAccessToken(context.req.raw.headers, context.req.valid('json').id),
          context
        )
        return result instanceof Response ? result : context.json({ ok: true as const })
      }
    )
}

export type CloudAccessTokenRoutes = ReturnType<typeof createAccessTokenRoutes>
