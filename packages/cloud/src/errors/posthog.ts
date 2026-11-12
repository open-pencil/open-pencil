import { PostHog, type PostHogOptions } from 'posthog-node'

/** Where a server caught an error, and for a request, its method, matched route, and ID. */
export type ErrorReportContext<Source extends string = string> = {
  source: Source
  method?: string
  route?: string
  /** The request's ID, as `cloudRequestId` named it; logs carry it too. */
  requestId?: string
  /** What failed, as the server's log says it; not sent to PostHog, whose report has the error. */
  message?: string
}

/** Sends a caught error where it is seen; it never rejects. */
export type ErrorReporter<Source extends string = string> = (
  error: unknown,
  context: ErrorReportContext<Source>
) => Promise<void>

export type PostHogErrorReporterOptions = {
  /** The project API key, or how to read it; a key that cannot be read yet is read again later. */
  key: string | (() => Promise<string>)
  host: string
  /** Sent with every report: which service and deployment report, never who made the request. */
  properties: Record<string, string>
  /** The property that names the context's `source`, such as `cloud_source`. */
  sourceProperty: string
  /** Names the service in its own log, such as `Cloud`. */
  logName: string
  fetch?: PostHogOptions['fetch']
}

/**
 * Reports errors to PostHog error tracking, each as it is caught, as a `$exception` with no person
 * profile and no GeoIP. A report carries `properties`, the source, and a request's method and
 * matched route and ID; never who made the request or what it carried.
 */
export function createPostHogErrorReporter<Source extends string>(
  options: PostHogErrorReporterOptions
): ErrorReporter<Source> {
  const { key, logName } = options
  const connect = async () => {
    const client = new PostHog(typeof key === 'string' ? key : await key(), {
      host: options.host,
      disableGeoip: true,
      // The SDK's own fetch unless a caller passes one.
      ...(options.fetch && { fetch: options.fetch })
    })
    // The SDK resolves a capture that PostHog refused and emits the refusal instead.
    client.on('error', (failure: unknown) => {
      console.error(`[${logName}] PostHog refused an error report:`, failure)
    })
    return client
  }
  let connecting: Promise<PostHog> | undefined
  const posthog = async () => {
    connecting ??= connect()
    try {
      return await connecting
    } catch (failure) {
      connecting = undefined
      throw failure
    }
  }
  return async (error, context) => {
    try {
      const client = await posthog()
      // Undefined request fields are left out of the event's JSON.
      await client.captureExceptionImmediate(error, undefined, {
        ...options.properties,
        [options.sourceProperty]: context.source,
        http_method: context.method,
        http_route: context.route,
        request_id: context.requestId
      })
    } catch (failure) {
      console.error(`[${logName}] Reporting an error failed:`, failure)
    }
  }
}
