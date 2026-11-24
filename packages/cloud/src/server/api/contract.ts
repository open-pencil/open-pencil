import { CLOUD_API_ERROR_STATUS } from '#cloud/contract'
import { ORPCError } from '@orpc/client'
import { ValidationError } from '@orpc/contract'
import { OpenAPIHandler } from '@orpc/openapi/fetch'
import type { Context as ProcedureContext, Router } from '@orpc/server'
import { RethrowHandlerPlugin } from '@orpc/server/plugins'
import type { Context, Env, MiddlewareHandler } from 'hono'
import { routePath } from 'hono/route'

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
  return async (c, next) => {
    // Where this middleware is mounted, such as `/api/*`: the routes' paths start there.
    const mount = routePath(c).replace(/\/\*$/, '')
    const result = await handler.handle(c.req.raw, {
      prefix: isPath(mount) ? mount : undefined,
      context: context(c)
    })
    if (!result.matched) return next()
    c.res = result.response
  }
}
