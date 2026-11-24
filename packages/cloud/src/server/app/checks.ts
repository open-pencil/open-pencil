import { createCloudIdentityResolver, createCloudSessionResolver } from '#cloud/server/auth'
import { resourceChallenge } from '#cloud/server/oauth'
import {
  declaredTokenRoute,
  grantReaches,
  refuseTokenRoute,
  type GrantReach,
  type TokenRouteRefusal
} from '#cloud/server/tokens'
import type { Context } from 'hono'

import type { CloudServices } from './services'

/** Who a request comes from: anyone signed in, an account that may use the server, or may leave. */
export function createRequestResolvers(services: CloudServices) {
  return {
    resolveIdentity: services.resolveIdentity ?? createCloudIdentityResolver(services.auth),
    resolveSession: services.resolveSession ?? createCloudSessionResolver(services.auth),
    resolveAccountSession:
      services.resolveAccountSession ??
      (services.resolveSession
        ? services.resolveSession
        : (request: Request) => services.auth.resolveAccountSession(request.headers)),
    twoStepConfirmed:
      services.twoStepConfirmed ??
      (services.resolveIdentity
        ? async () => true
        : (request: Request) => services.auth.twoStepConfirmed(request.headers))
  }
}

/** The checks routes put in front of themselves to name the request's actor. */
export function createRequestChecks(
  services: CloudServices,
  resolvers: ReturnType<typeof createRequestResolvers>
) {
  const { resolveSession, resolveAccountSession } = resolvers
  const oauth = services.config.oauthEnabled
  const challenge = (context: Context, missingScope?: string) => {
    const header = resourceChallenge(services.config.publicURL, missingScope)
    if (header) context.header('WWW-Authenticate', header)
  }
  /** A personal access token, or else an app's access token where apps may connect. */
  const resolveToken = async (headers: Headers) =>
    (await services.auth.resolveAccessToken(headers)) ??
    (oauth ? await services.auth.resolveAppToken(headers) : null)
  /** Apps learn where to get a token from the challenge (RFC 9728 §5.1). */
  const unauthorized = (context: Context) => {
    if (oauth) challenge(context)
    return context.json({ error: { code: 'unauthorized' as const } }, 401)
  }
  const refused = (context: Context, refusal: TokenRouteRefusal, scope: string | undefined) => {
    if (refusal === 'not-declared') return unauthorized(context)
    if (refusal === 'insufficient-scope') {
      // So an app can ask the person for the scope it lacks.
      if (scope) challenge(context, scope)
      return context.json({ error: { code: 'insufficient_scope' as const } }, 403)
    }
    return context.json({ error: { code: 'forbidden' as const } }, 403)
  }
  return {
    requireActiveSession: async (context: Context, next: () => Promise<void>) => {
      // A route that lets an account leave before accepting the terms named it already.
      if (context.get('actor')) return next()
      const actor = await resolveSession(context.req.raw)
      if (!actor) return context.json({ error: { code: 'unauthorized' as const } }, 401)
      context.set('actor', actor)
      return next()
    },
    /**
     * The API's caller: a session, or else a token on a route that declares what tokens it takes
     * (`tokenRoute`): a personal access token, or an app's, held to its scopes and, for an app, to
     * its grant's workspace. Account routes never get here.
     */
    requireActiveActor: async (context: Context, next: () => Promise<void>) => {
      if (context.get('actor')) return next()
      const session = await resolveSession(context.req.raw)
      if (session) {
        context.set('actor', session)
        return next()
      }
      const route = declaredTokenRoute(context)
      const actor = route ? await resolveToken(context.req.raw.headers) : null
      if (!actor) return unauthorized(context)
      const refusal = refuseTokenRoute(actor, route)
      if (refusal) return refused(context, refusal, route?.scope)
      context.set('actor', actor)
      const grant = actor.grant
      if (grant) {
        const reach: GrantReach = (target, id) =>
          grantReaches(services.database, grant.workspaceId, target, id)
        context.set('grantReach', reach)
      }
      return next()
    },
    /**
     * An account that may leave: one that has terms to accept can still download its documents
     * and delete itself, which nothing else lets it do until it accepts.
     */
    requireAccountSession: async (context: Context, next: () => Promise<void>) => {
      const actor = await resolveAccountSession(context.req.raw)
      if (!actor) return context.json({ error: { code: 'unauthorized' as const } }, 401)
      context.set('actor', actor)
      return next()
    },
    /** Reading one document, which downloading everything before leaving needs, without terms. */
    allowLeavingRead: async (context: Context, next: () => Promise<void>) => {
      if (context.req.method === 'GET') {
        const actor = await resolveAccountSession(context.req.raw)
        if (actor) context.set('actor', actor)
      }
      return next()
    }
  }
}
