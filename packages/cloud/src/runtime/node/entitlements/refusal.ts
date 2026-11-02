import type { CloudServerConfig } from '#cloud/server'

/**
 * Why the `entitlements` command must not write, if it must not: with
 * `[entitlements] source = "static"` the server never reads the database rows it would change.
 */
export function entitlementWriteRefusal(
  config: Pick<CloudServerConfig, 'staticEntitlements'>,
  operation: string | undefined,
  dryRun: boolean
): string | null {
  if (!config.staticEntitlements || dryRun) return null
  if (operation !== 'set' && operation !== 'clear') return null
  return 'Entitlements come from the static [entitlements] table in the deployment TOML; change them there'
}
