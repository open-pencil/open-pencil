import type { Context, ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { routePath } from 'hono/route'

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

/** What the server knows about a caught error; never who made the request or what it carried. */
export type CloudErrorContext = {
  source: CloudErrorSource
  /** For a request: its method and the route pattern it matched, not the path with its IDs. */
  method?: string
  route?: string
}

/**
 * Sends a caught error to the deployment's error tracking. Runtimes create one only when the
 * deployment configures error tracking; its promise never rejects.
 */
export type CloudErrorReporter = (error: unknown, context: CloudErrorContext) => Promise<void>

/** Logs a caught error and reports it, when the deployment reports errors. */
export function reportCloudError(
  reporter: CloudErrorReporter | undefined,
  message: string,
  error: unknown,
  context: CloudErrorContext
): Promise<void> {
  console.error(`[Cloud] ${message}`, error)
  return reporter ? reporter(error, context) : Promise.resolve()
}

function requestContext(context: Context): CloudErrorContext {
  return { source: 'request', method: context.req.method, route: routePath(context) }
}

/**
 * The app's last error handler, as Hono's default: an `HTTPException` answers with its response,
 * anything else is logged, reported, and answered with a 500.
 */
export function cloudErrorHandler(reporter: CloudErrorReporter | undefined): ErrorHandler {
  return (error, context) => {
    if (error instanceof HTTPException) return error.getResponse()
    void reportCloudError(reporter, 'Request failed:', error, requestContext(context))
    return context.text('Internal Server Error', 500)
  }
}
