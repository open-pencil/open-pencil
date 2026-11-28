import {
  CLOUD_AGENT_PAIRING_CODE_PREFIX,
  cloudAgentPairingDecisionSchema,
  CLOUD_AUTHORIZATION_SERVER_METADATA_PATH,
  CLOUD_OAUTH_SCOPES,
  CLOUD_PROTECTED_RESOURCE_METADATA_PATH,
  CLOUD_MCP_PATH,
  cloudAPIResource,
  cloudAppConnectionRevokeSchema,
  cloudMCPResource,
  cloudOAuthDecisionSchema
} from '#cloud/contract'
import type { CloudAPIEnvironment } from '#cloud/server/api'
import { validatedJSON, validatedQuery } from '#cloud/server/validation'
import type { ResourceServerMetadata } from '@better-auth/oauth-provider'
import { Hono, type MiddlewareHandler } from 'hono'
import * as v from 'valibot'

import type { AgentPairingGrants } from './pairing'
import { OAuthRequestError, type OAuthService } from './service'

export type OAuthRouteDependencies = {
  publicURL: string
  service: OAuthService
  /** Pairing an agent with an editor without an account, where the server does. */
  pairing?: AgentPairingGrants
  /** Counts what anyone without an account asks, by address. */
  publicRateLimiter: MiddlewareHandler
  /** The authorization server's metadata, as the OAuth provider builds it (RFC 8414). */
  serverMetadata(): Promise<unknown>
  requireActiveSession: MiddlewareHandler<CloudAPIEnvironment>
  authenticatedMutationLimiter: MiddlewareHandler<CloudAPIEnvironment>
}

const requestQuerySchema = v.object({
  query: v.pipe(v.string(), v.minLength(1), v.maxLength(8192))
})

const FAILURE_STATUS = {
  invalid_request: 400,
  workspace_not_found: 404
} as const satisfies Record<OAuthRequestError['code'], number>

/** Where apps exchange a code, as the OAuth provider serves it. */
const TOKEN_PATH = '/api/auth/oauth2/token'

/**
 * Pairing an agent with an editor without an account: the pairing page's routes, and the exchange of
 * its codes ahead of the OAuth provider's token endpoint, which answers every other code.
 */
function createPairingRoutes(
  pairing: AgentPairingGrants | undefined,
  publicRateLimiter: MiddlewareHandler,
  failure: (error: unknown) => Response
) {
  const router = new Hono<CloudAPIEnvironment>()
  if (!pairing) return router
  return router
    .use('/api/agent-pairing/*', publicRateLimiter)
    .get('/api/agent-pairing/request', validatedQuery(requestQuerySchema), async (context) => {
      try {
        return context.json({ request: await pairing.request(context.req.valid('query').query) })
      } catch (error) {
        return failure(error)
      }
    })
    .post(
      '/api/agent-pairing/decision',
      validatedJSON(cloudAgentPairingDecisionSchema),
      async (context) => {
        try {
          return context.json({ redirect: await pairing.decide(context.req.valid('json')) })
        } catch (error) {
          return failure(error)
        }
      }
    )
    .post(TOKEN_PATH, async (context, next) => {
      const type = context.req.header('content-type') ?? ''
      if (!type.startsWith('application/x-www-form-urlencoded')) return next()
      const form = new URLSearchParams(await context.req.raw.clone().text())
      if (!form.get('code')?.startsWith(CLOUD_AGENT_PAIRING_CODE_PREFIX)) return next()
      const refused = await publicRateLimiter(context, async () => {
        const answer = await pairing.exchange(form)
        context.header('Cache-Control', 'no-store')
        context.res = context.json(answer, 'error' in answer ? 400 : 200)
      })
      return refused ?? context.res
    })
}

/** The issuer's path, where clients that follow RFC 8414 look for its metadata. */
const ISSUER_PATH = '/api/auth'

/**
 * What a server that accepts apps answers: the protected resource metadata (RFC 9728) of the
 * document API and the MCP endpoint and the authorization server's (RFC 8414) at the addresses
 * clients look, the approval page's routes, and the account's connected apps.
 */
export function createOAuthRoutes(dependencies: OAuthRouteDependencies) {
  const { service } = dependencies
  const metadataFor = (resource: string): ResourceServerMetadata => ({
    resource,
    authorization_servers: [new URL(ISSUER_PATH, dependencies.publicURL).href],
    scopes_supported: [...CLOUD_OAUTH_SCOPES],
    bearer_methods_supported: ['header'],
    resource_name: 'OpenPencil Cloud'
  })
  const resourceMetadata = metadataFor(cloudAPIResource(dependencies.publicURL))
  const mcpMetadata = metadataFor(cloudMCPResource(dependencies.publicURL))
  const failure = (error: unknown) => {
    if (error instanceof OAuthRequestError) {
      return Response.json({ error: { code: error.code } }, { status: FAILURE_STATUS[error.code] })
    }
    throw error
  }
  return new Hono<CloudAPIEnvironment>()
    .get(`${CLOUD_PROTECTED_RESOURCE_METADATA_PATH}/api`, (context) =>
      context.json(resourceMetadata)
    )
    .get(`${CLOUD_PROTECTED_RESOURCE_METADATA_PATH}${CLOUD_MCP_PATH}`, (context) =>
      context.json(mcpMetadata)
    )
    .get(CLOUD_PROTECTED_RESOURCE_METADATA_PATH, (context) => context.json(resourceMetadata))
    .get(`${CLOUD_AUTHORIZATION_SERVER_METADATA_PATH}${ISSUER_PATH}`, async (context) =>
      context.json(await dependencies.serverMetadata())
    )
    .get(CLOUD_AUTHORIZATION_SERVER_METADATA_PATH, async (context) =>
      context.json(await dependencies.serverMetadata())
    )
    .route('/', createPairingRoutes(dependencies.pairing, dependencies.publicRateLimiter, failure))
    .use('/api/oauth/*', dependencies.requireActiveSession)
    .use('/api/account/connections', dependencies.requireActiveSession)
    .use('/api/account/connections/*', dependencies.requireActiveSession)
    .use('/api/account/connections/*', dependencies.authenticatedMutationLimiter)
    .use('/api/oauth/decision', dependencies.authenticatedMutationLimiter)
    .get('/api/oauth/request', validatedQuery(requestQuerySchema), async (context) => {
      try {
        const request = await service.request(
          context.get('actor').userId,
          context.req.valid('query').query
        )
        return context.json({ request })
      } catch (error) {
        return failure(error)
      }
    })
    .post('/api/oauth/decision', validatedJSON(cloudOAuthDecisionSchema), async (context) => {
      try {
        const redirect = await service.decide(
          context.req.raw,
          context.get('actor').userId,
          context.req.valid('json')
        )
        return context.json({ redirect })
      } catch (error) {
        return failure(error)
      }
    })
    .get('/api/account/connections', async (context) =>
      context.json({ connections: await service.connections(context.get('actor').userId) })
    )
    .post(
      '/api/account/connections/revoke',
      validatedJSON(cloudAppConnectionRevokeSchema),
      async (context) => {
        const revoked = await service.revoke(
          context.get('actor').userId,
          context.req.valid('json').id
        )
        if (!revoked) return context.json({ error: { code: 'not_found' as const } }, 404)
        return context.json({ ok: true as const })
      }
    )
}

export type CloudOAuthRoutes = ReturnType<typeof createOAuthRoutes>
