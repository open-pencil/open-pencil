import type { CloudServerConfig } from '#cloud/server'
import type { CloudErrorReporter } from '#cloud/server/errors'
import { PostHog, type PostHogOptions } from 'posthog-node'

/** Which runtime serves the deployment, as its error reports name it. */
export type CloudRuntimeName = 'node' | 'cloudflare'

/**
 * Reports server errors to the PostHog project the deployment's `[error_tracking]` names, or
 * returns nothing when it names none. Each error is sent as it is caught, as a `$exception` with
 * no person profile: reports carry the runtime, the deployment, and where the error was caught,
 * never who made the request or what it carried.
 */
export function createPostHogErrorReporter(
  config: CloudServerConfig,
  runtime: CloudRuntimeName,
  options: Pick<PostHogOptions, 'fetch'> = {}
): CloudErrorReporter | undefined {
  const tracking = config.errorTracking
  if (!tracking) return undefined
  const client = new PostHog(tracking.projectAPIKey, {
    host: tracking.host,
    disableGeoip: true,
    ...options
  })
  // The SDK resolves a capture that PostHog refused and emits the refusal instead.
  client.on('error', (failure: unknown) => {
    console.error('[Cloud] PostHog refused an error report:', failure)
  })
  const deployment = {
    cloud_runtime: runtime,
    cloud_deployment: config.deployment,
    cloud_host: new URL(config.publicURL).host
  }
  return async (error, context) => {
    try {
      // Undefined request fields are left out of the event's JSON.
      await client.captureExceptionImmediate(error, undefined, {
        ...deployment,
        cloud_source: context.source,
        http_method: context.method,
        http_route: context.route
      })
    } catch (failure) {
      console.error('[Cloud] Reporting an error failed:', failure)
    }
  }
}
