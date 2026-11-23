import {
  CLOUD_AUTHORIZATION_SERVER_METADATA_PATH,
  CLOUD_OAUTH_SCOPES,
  CLOUD_PROTECTED_RESOURCE_METADATA_PATH,
  cloudAPIResource,
  cloudAppConnectionRevokeSchema,
  cloudOAuthDecisionSchema
} from '#cloud/contract'
import type { CloudAPIEnvironment } from '#cloud/server/api'
import { validatedJSON, validatedQuery } from '#cloud/server/validation'
import { Hono, type MiddlewareHandler } from 'hono'
import * as v from 'valibot'

import { OAuthRequestError, type OAuthService } from './service'

export type OAuthRouteDependencies = {
  publicURL: string
  service: OAuthService
  /** The authorization server's metadata, as the OAuth provider builds it (RFC 8414). */
  serverMetadata(): Promise<unknown>
  /** The signed-in session's ID, which the workspace an app gets is recorded against. */
  sessionID(headers: Headers): Promise<string | null>
  requireActiveSession: MiddlewareHandler<CloudAPIEnvironment>
  authenticatedMutationLimiter: MiddlewareHandler<CloudAPIEnvironment>
}

const requestQuerySchema = v.object({
  query: v.pipe(v.string(), v.minLength(1), v.maxLength(8192))
})

/** The issuer's path, where clients that follow RFC 8414 look for its metadata. */
const ISSUER_PATH = '/api/auth'

/**
 * What a server that accepts apps answers: the document API's protected resource metadata
 * (RFC 9728) and the authorization server's (RFC 8414) at the addresses clients look, the
 * approval page's routes, and the account's connected apps.
 */
export function createOAuthRoutes(dependencies: OAuthRouteDependencies) {
  const { service } = dependencies
  const resourceMetadata = {
    resource: cloudAPIResource(dependencies.publicURL),
    authorization_servers: [new URL(ISSUER_PATH, dependencies.publicURL).href],
    scopes_supported: [...CLOUD_OAUTH_SCOPES],
    bearer_methods_supported: ['header'],
    resource_name: 'OpenPencil Cloud'
  }
  const failure = (error: unknown) => {
    if (error instanceof OAuthRequestError) {
      return Response.json(
        { error: { code: error.code } },
        { status: error.code === 'workspace_not_found' ? 404 : 400 }
      )
    }
    throw error
  }
  return new Hono<CloudAPIEnvironment>()
    .get(`${CLOUD_PROTECTED_RESOURCE_METADATA_PATH}/api`, (context) =>
      context.json(resourceMetadata)
    )
    .get(CLOUD_PROTECTED_RESOURCE_METADATA_PATH, (context) => context.json(resourceMetadata))
    .get(`${CLOUD_AUTHORIZATION_SERVER_METADATA_PATH}${ISSUER_PATH}`, async (context) =>
      context.json(await dependencies.serverMetadata())
    )
    .get(CLOUD_AUTHORIZATION_SERVER_METADATA_PATH, async (context) =>
      context.json(await dependencies.serverMetadata())
    )
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
      const sessionId = await dependencies.sessionID(context.req.raw.headers)
      if (!sessionId) return context.json({ error: { code: 'unauthorized' as const } }, 401)
      try {
        const redirect = await service.decide(
          context.req.raw,
          { id: sessionId, userId: context.get('actor').userId },
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
