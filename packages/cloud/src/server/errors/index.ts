import type { ErrorReportContext, ErrorReporter } from '#cloud/errors'
import { loggedError, writeJSONLine, type CloudLogWriter } from '#cloud/server/logging'
import type { Context, ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { routePath } from 'hono/route'
import * as v from 'valibot'

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
 * What the server knows about a caught error. For a request: its method, the route pattern it
 * matched, its ID, the signed-in user's account ID, and the IDs of the records its path names;
 * never what it carried. Error tracking sends the account and record IDs only where the
 * deployment's `[error_tracking]` sets `include_ids`; the server's own log always has them.
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
        userId: context.userId,
        ...context.resources,
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

/**
 * Path parameters that name a record by its ID. Others are left out: an invitation's or a
 * continuation's ID is the link that grants it, and an OAuth callback's names a provider.
 */
const RECORD_PARAMETERS = [
  'documentId',
  'workspaceId',
  'threadId',
  'commentId',
  'versionId',
  'revisionId',
  'shareId',
  'uploadId'
] as const

const validatedParametersSchema = v.record(v.string(), v.unknown())

/**
 * The record IDs the request's path named, as its route's parameter validator accepted them: a
 * path no validator checked names none, so what a caller typed never reaches a report.
 */
function requestResources(context: Context): Record<string, string> {
  const validated = v.safeParse(validatedParametersSchema, context.req.valid('param' as never))
  if (!validated.success) return {}
  return Object.fromEntries(
    RECORD_PARAMETERS.flatMap((name) => {
      const id = validated.output[name]
      return typeof id === 'string' ? [[name, id]] : []
    })
  )
}

function requestContext(context: Context): CloudErrorContext {
  const requestId: unknown = context.get('requestId')
  const actor: unknown = context.get('actor')
  const resources = requestResources(context)
  const userId =
    actor && typeof actor === 'object' && 'userId' in actor && typeof actor.userId === 'string'
      ? actor.userId
      : undefined
  return {
    source: 'request',
    method: context.req.method,
    route: routePath(context),
    ...(Object.keys(resources).length > 0 && { resources }),
    ...(typeof requestId === 'string' && { requestId }),
    ...(userId && { userId })
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
