import { createCloudIdentityResolver, createCloudSessionResolver } from '#cloud/server/auth'
import type { Context } from 'hono'

import type { CloudServices } from './services'

/**
 * The routes a personal access token reaches: workspaces and their documents, uploads, versions,
 * sharing, and Trash, and who it signs in as. Anything else, such as services tokens that spend
 * credits or administration, takes a session, including routes added later.
 */
const ACCESS_TOKEN_API_PATHS = [
  '/api/session',
  '/api/workspaces',
  '/api/documents',
  '/api/uploads',
  '/api/shared-documents',
  '/api/trash'
]
const acceptsAccessToken = (path: string) =>
  ACCESS_TOKEN_API_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))

/** Who a request comes from: anyone signed in, an account that may use the server, or may leave. */
export function createRequestResolvers(services: CloudServices) {
  return {
    resolveIdentity: services.resolveIdentity ?? createCloudIdentityResolver(services.auth),
    resolveSession: services.resolveSession ?? createCloudSessionResolver(services.auth),
    resolveAccountSession:
      services.resolveAccountSession ??
      (services.resolveSession
        ? services.resolveSession
        : (request: Request) => services.auth.resolveAccountSession(request.headers))
  }
}

/** The checks routes put in front of themselves to name the request's actor. */
export function createRequestChecks(
  services: CloudServices,
  resolvers: ReturnType<typeof createRequestResolvers>
) {
  const { resolveSession, resolveAccountSession } = resolvers
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
     * The API's caller: a session, or else a personal access token on the routes that take one
     * (`ACCESS_TOKEN_API_PATHS`); account routes never get here.
     */
    requireActiveActor: async (context: Context, next: () => Promise<void>) => {
      if (context.get('actor')) return next()
      const actor =
        (await resolveSession(context.req.raw)) ??
        (acceptsAccessToken(context.req.path)
          ? await services.auth.resolveAccessToken(context.req.raw.headers)
          : null)
      if (!actor) return context.json({ error: { code: 'unauthorized' as const } }, 401)
      context.set('actor', actor)
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
