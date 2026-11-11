import { loggedError, writeJSONLine, type CloudLogWriter } from '#cloud/server/logging'
import type { Context, ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { routePath } from 'hono/route'

import type { ErrorReportContext, ErrorReporter } from './posthog'

/** Where the server caught an error. */
export const CLOUD_ERROR_SOURCES = [
  'request',
  'background',
  'cleanup',
  'email',
  'relay',
  'scheduled',
  'setup'
] as const
export type CloudErrorSource = (typeof CLOUD_ERROR_SOURCES)[number]

/**
 * What the server knows about a caught error; never who made the request or what it carried. For a
 * request: its method, the route pattern it matched (not the path with its IDs), and its ID.
 */
export type CloudErrorContext = ErrorReportContext<CloudErrorSource>

/**
 * Logs a caught error and, when the deployment configures error tracking, sends it there. Runtimes
 * create one with `createLoggingErrorReporter`; its promise never rejects.
 */
export type CloudErrorReporter = ErrorReporter<CloudErrorSource>

/**
 * A reporter that writes the error as a structured line with the runtime's writer, then hands it
 * to `send`, such as PostHog's, if the deployment has one.
 */
export function createLoggingErrorReporter(
  log: CloudLogWriter,
  send?: CloudErrorReporter
): CloudErrorReporter {
  return async (error, context) => {
    try {
      log({
        level: 'error',
        message: context.message ?? 'Failed',
        source: context.source,
        method: context.method,
        route: context.route,
        requestId: context.requestId,
        error: loggedError(error)
      })
    } catch (failure) {
      // A writer that fails must not stop the report or reject; the console still gets both.
      console.error('[Cloud] Writing a log line failed:', failure, error)
    }
    await send?.(error, context)
  }
}

/** Without a reporter, errors are still logged, as lines of JSON. */
const logOnly = createLoggingErrorReporter(writeJSONLine)

/** Logs a caught error and reports it, through the runtime's reporter. */
export function reportCloudError(
  reporter: CloudErrorReporter | undefined,
  message: string,
  error: unknown,
  context: CloudErrorContext
): Promise<void> {
  return (reporter ?? logOnly)(error, { ...context, message })
}

function requestContext(context: Context): CloudErrorContext {
  const requestId: unknown = context.get('requestId')
  return {
    source: 'request',
    method: context.req.method,
    route: routePath(context),
    ...(typeof requestId === 'string' && { requestId })
  }
}

/**
 * The app's last error handler, as Hono's default: an `HTTPException` answers with its response,
 * anything else is logged, reported, and answered with a 500 naming the request's `X-Request-Id`.
 */
export function cloudErrorHandler(reporter: CloudErrorReporter | undefined): ErrorHandler {
  return (error, context) => {
    if (error instanceof HTTPException) return error.getResponse()
    void reportCloudError(reporter, 'Request failed', error, requestContext(context))
    return context.text('Internal Server Error', 500)
  }
}

export {
  createPostHogErrorReporter,
  type ErrorReportContext,
  type ErrorReporter,
  type PostHogErrorReporterOptions
} from './posthog'
