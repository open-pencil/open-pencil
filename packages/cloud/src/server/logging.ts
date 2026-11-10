import type { MiddlewareHandler } from 'hono'

export type CloudLogLevel = 'error' | 'warn' | 'info'

export type CloudLoggedError = {
  name: string
  message: string
  stack?: string
  cause?: CloudLoggedError
}

/** What a log line carries besides its message; never who made a request or what it carried. */
export type CloudLogFields = Record<
  string,
  string | number | boolean | undefined | CloudLoggedError
>

/** One structured log line. */
export type CloudLogLine = CloudLogFields & { level: CloudLogLevel; message: string }

/**
 * Writes a log line where the runtime's logs go, in the form they index best. Runtimes pass their
 * own to `createLoggingErrorReporter`; `writeJSONLine` is the default.
 */
export type CloudLogWriter = (line: CloudLogLine) => void

/** Writes the line as one line of JSON, at the console method of its level. */
export const writeJSONLine: CloudLogWriter = (line) => {
  console[line.level](JSON.stringify(line))
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
 * Writes a warning or note through the default writer, from code no runtime hands a writer to.
 * Errors go through `reportCloudError`, which logs with the runtime's.
 */
export function logCloud(level: CloudLogLevel, message: string, fields: CloudLogFields = {}): void {
  writeJSONLine({ ...fields, level, message })
}

/** Reads the ID that what stands in front of the server gave a request, if the runtime trusts it. */
export type ForwardedRequestId = (headers: Headers) => string | undefined

/**
 * Names each request as the `requestId` variable, from what the runtime trusts in front of it
 * (such as Cloudflare's ray ID) or else a new UUID, and answers with it as `X-Request-Id` so a
 * person reporting a failure can quote it.
 */
export function cloudRequestId(
  forwarded?: ForwardedRequestId
): MiddlewareHandler<{ Variables: { requestId: string } }> {
  return async (context, next) => {
    const id = forwarded?.(context.req.raw.headers) ?? crypto.randomUUID()
    context.set('requestId', id)
    context.header('X-Request-Id', id)
    await next()
  }
}
