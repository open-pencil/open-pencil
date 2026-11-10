import type { Context, MiddlewareHandler } from 'hono'

export type CloudLogLevel = 'error' | 'warn' | 'info'

/** What a log line carries besides its message; never who made a request or what it carried. */
export type CloudLogFields = Record<
  string,
  string | number | boolean | undefined | CloudLoggedError
>

export type CloudLoggedError = {
  name: string
  message: string
  stack?: string
  cause?: CloudLoggedError
}

/** How deep a chain of causes is written out. */
const MAXIMUM_CAUSES = 4

/** An error as a log line keeps it: its name, message, stack, and causes. */
export function loggedError(error: unknown, depth = 0): CloudLoggedError {
  if (!(error instanceof Error)) return { name: 'NonError', message: String(error) }
  const cause =
    error.cause !== undefined && depth < MAXIMUM_CAUSES
      ? loggedError(error.cause, depth + 1)
      : undefined
  return { name: error.name, message: error.message, stack: error.stack, ...(cause && { cause }) }
}

/**
 * Workers Logs indexes the keys of an object passed to `console`, but not of a string; Node and
 * Bun write an object across several lines, so there a line of JSON is written instead.
 */
const LOGS_OBJECTS = runsOnWorkers()

/** Whether this is workerd, whose `navigator.userAgent` is `Cloudflare-Workers`. */
function runsOnWorkers(): boolean {
  // The server's types leave out the DOM's `navigator`.
  const runtime: unknown = Reflect.get(globalThis, 'navigator')
  return (
    typeof runtime === 'object' &&
    runtime !== null &&
    Reflect.get(runtime, 'userAgent') === 'Cloudflare-Workers'
  )
}

/**
 * Writes one structured log line, at the console method of its level, as
 * `{ level, message, ...fields }`.
 */
export function logCloud(level: CloudLogLevel, message: string, fields: CloudLogFields = {}): void {
  const line = { level, message, ...fields }
  console[level](LOGS_OBJECTS ? line : JSON.stringify(line))
}

/** Cloudflare's ray ID, such as `8f1e2d3c4b5a6978-FRA`. */
const RAY_ID = /^[0-9a-f]{16}(-[A-Z]{3})?$/
/** What a proxy's `X-Request-Id` may hold to be kept. */
const PROXY_REQUEST_ID = /^[\w-]{1,128}$/

/**
 * The ID logs and error reports name a request by: Cloudflare's ray ID when Cloudflare sent the
 * request, else the `X-Request-Id` a proxy in front set, else none.
 */
export function forwardedRequestId(headers: Headers): string | undefined {
  const ray = headers.get('cf-ray')
  if (ray && RAY_ID.test(ray)) return ray
  const forwarded = headers.get('x-request-id')
  return forwarded && PROXY_REQUEST_ID.test(forwarded) ? forwarded : undefined
}

export type RequestIdEnvironment = { Variables: { requestId: string } }

/**
 * Names each request (see `forwardedRequestId`, or a new UUID) as the `requestId` variable and
 * answers with it as `X-Request-Id`, so a person reporting a failure can quote it.
 */
export const cloudRequestId: MiddlewareHandler<RequestIdEnvironment> = async (context, next) => {
  const id = forwardedRequestId(context.req.raw.headers) ?? crypto.randomUUID()
  context.set('requestId', id)
  context.header('X-Request-Id', id)
  await next()
}

/** The request's ID, from `cloudRequestId` or, before it ran, the forwarded one. */
export function requestIdOf(context: Context): string | undefined {
  const id: unknown = context.get('requestId')
  return typeof id === 'string' ? id : forwardedRequestId(context.req.raw.headers)
}
