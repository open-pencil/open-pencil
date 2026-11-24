import { CLOUD_API_ERROR_STATUS } from '#cloud/contract'
import { nameContractRoute } from '#cloud/server/errors'
import { ORPCError } from '@orpc/client'
import { ValidationError } from '@orpc/contract'
import { getOpenAPIMeta } from '@orpc/openapi'
import { OpenAPIHandler } from '@orpc/openapi/fetch'
import type { Context as ProcedureContext, Router } from '@orpc/server'
import { walkProcedureContractsSync } from '@orpc/server'
import { RethrowHandlerPlugin } from '@orpc/server/plugins'
import type { Context, Env, MiddlewareHandler } from 'hono'
import { routePath } from 'hono/route'
import { TrieRouter } from 'hono/router/trie-router'

/** Whether `path` is one, rather than the empty path of a router mounted at the root. */
function isPath(path: string): path is `/${string}` {
  return path.startsWith('/')
}

/** Whether a schema issue is about a route parameter, which then names nothing. */
function isParamIssue(issue: ValidationError['issues'][number]): boolean {
  const first = issue.path?.[0]
  const key = typeof first === 'object' ? first.key : first
  return key === 'params'
}

/**
 * Answers the routes `router` implements, under the path this middleware is mounted at, and lets every
 * other request through. Errors travel as `{ "error": { "code": … } }`: input that fails its schema
 * is `invalid_request`, or `not_found` when a route parameter does, and anything a route did not
 * expect goes on to the app's error handler, which reports it.
 */
export function contractRoutes<E extends Env, T extends ProcedureContext>(
  router: Router<T>,
  context: (c: Context<E>) => T
): MiddlewareHandler<E> {
  const handler = new OpenAPIHandler<T>(router, {
    errorStatusMap: CLOUD_API_ERROR_STATUS,
    errorResponseBodyEncoder: (error: ORPCError<string, unknown>) => ({
      error: { code: error.code }
    }),
    interceptors: [
      async (options) => {
        try {
          return await options.next()
        } catch (error) {
          if (
            error instanceof ORPCError &&
            error.code === 'BAD_REQUEST' &&
            error.cause instanceof ValidationError
          ) {
            const code = error.cause.issues.some(isParamIssue) ? 'not_found' : 'invalid_request'
            throw new ORPCError(code, { cause: error })
          }
          throw error
        }
      }
    ],
    plugins: [
      new RethrowHandlerPlugin({
        filter: (error) => !(error instanceof ORPCError) || error.code === 'INTERNAL_SERVER_ERROR'
      })
    ]
  })
  // Each procedure's route, to name the one a request reached when its error is reported.
  const routes = new TrieRouter<string>()
  walkProcedureContractsSync(router, (procedure) => {
    const meta = getOpenAPIMeta(procedure)
    if (!meta?.method || !meta.path) return
    const pattern = meta.path.replace(/\{\+?(\w+)\}/g, ':$1')
    routes.add(meta.method, pattern, pattern)
  })
  return async (c, next) => {
    // Where this middleware is mounted, such as `/api/*`: the routes' paths start there.
    const mount = routePath(c).replace(/\/\*$/, '')
    const path = c.req.path.slice(mount.length) || '/'
    // The contract's paths are exact, as the rate limits mounted on them are, so another spelling
    // of one, with a trailing slash, never reaches a route around its budget.
    if (path !== '/' && path.endsWith('/')) return next()
    // HEAD answers as GET would, without the body, as Hono's own routes do.
    const head = c.req.method === 'HEAD'
    const request = head ? new Request(c.req.raw, { method: 'GET' }) : c.req.raw
    try {
      const result = await handler.handle(request, {
        prefix: isPath(mount) ? mount : undefined,
        context: context(c)
      })
      if (!result.matched) return await next()
      c.res = head ? new Response(null, result.response) : result.response
    } catch (error) {
      const matched = routes.match(request.method, path)[0][0]
      if (matched) {
        const parameters = Object.fromEntries(
          Object.entries(matched[1]).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string'
          )
        )
        nameContractRoute(c, `${mount}${matched[0]}`, parameters)
      }
      throw error
    }
  }
}
