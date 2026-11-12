import { createPostHogErrorReporter } from '#cloud/errors'
import type { CloudServerConfig } from '#cloud/server'
import type { CloudErrorReporter } from '#cloud/server/errors'
import type { PostHogOptions } from 'posthog-node'

/** Which runtime serves the deployment, as its error reports name it. */
export type CloudRuntimeName = 'node' | 'cloudflare'

/**
 * Reports server errors to the PostHog project the deployment's `[error_tracking]` names, or
 * returns nothing when it names none. Reports carry the runtime, the deployment, and where the
 * error was caught, never who made the request or what it carried.
 */
export function createCloudErrorReporter(
  config: CloudServerConfig,
  runtime: CloudRuntimeName,
  options: Pick<PostHogOptions, 'fetch'> = {}
): CloudErrorReporter | undefined {
  const tracking = config.errorTracking
  if (!tracking) return undefined
  return createPostHogErrorReporter({
    key: tracking.projectAPIKey,
    host: tracking.host,
    properties: {
      cloud_runtime: runtime,
      cloud_deployment: config.deployment,
      cloud_host: new URL(config.publicURL).host
    },
    sourceProperty: 'cloud_source',
    logName: 'Cloud',
    fetch: options.fetch
  })
}
