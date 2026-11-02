import {
  loadAISigningKey,
  parseCloudDeploymentTOML,
  type AISigningKey,
  type CloudEnvironment,
  type CloudServerConfig
} from '#cloud/server'

import type { CollaborationRelayRPC } from './relay'

/** The bindings `deploy/cloudflare/wrangler.jsonc` gives the Worker and its relay objects. */
export type CloudflareCloudBindings = {
  /** PostgreSQL, through Hyperdrive. */
  HYPERDRIVE: Hyperdrive
  /** The collaboration relay, one object per document. */
  RELAY: DurableObjectNamespace<CollaborationRelayRPC>
  /** The built site, `dist-cloud`: the editor and the portal. */
  ASSETS: Fetcher
  /** Required by `[email] transport = "cloudflare"`. */
  EMAIL?: SendEmail
}

/** The bindings, plus the variables and secrets the deployment TOML names. */
export type CloudflareCloudEnvironment = CloudflareCloudBindings & Record<string, unknown>

export type PreparedCloudflareCloud = {
  config: CloudServerConfig
  aiSigningKey: AISigningKey | undefined
}

/** The Worker's string variables and secrets, with `DATABASE_URL` from Hyperdrive. */
function configEnvironment(env: CloudflareCloudEnvironment): CloudEnvironment {
  return {
    ...Object.fromEntries(
      Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    ),
    DATABASE_URL: env.HYPERDRIVE.connectionString
  }
}

/**
 * Reads the deployment TOML once per isolate: its config and AI signing key stay the same for the
 * Worker's lifetime. A failure is not kept, so the next request tries again.
 */
export function cloudflareCloudSetup(source: string) {
  let prepared: Promise<PreparedCloudflareCloud> | null = null
  return (env: CloudflareCloudEnvironment): Promise<PreparedCloudflareCloud> => {
    prepared ??= (async () => {
      const config = parseCloudDeploymentTOML(source, configEnvironment(env))
      return { config, aiSigningKey: await loadAISigningKey(config) }
    })().catch((error: unknown) => {
      prepared = null
      throw error
    })
    return prepared
  }
}
