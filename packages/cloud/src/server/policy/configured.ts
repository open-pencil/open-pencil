import type { CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely } from 'kysely'

import { DatabaseEntitlementSource } from './database'
import { StaticEntitlementSource } from './entitlements'
import { createDefaultCloudPolicy } from './policy'
import { EntitlementOpenFeatureProvider } from './provider'
import { staticEntitlementValues } from './static'

/** The policy a deployment configures: its static entitlements, or the database's. */
export function createConfiguredCloudPolicy(
  config: Pick<CloudServerConfig, 'staticEntitlements'>,
  database: Kysely<CloudDatabase>
) {
  return createDefaultCloudPolicy(
    new EntitlementOpenFeatureProvider(
      config.staticEntitlements
        ? new StaticEntitlementSource(staticEntitlementValues(config.staticEntitlements))
        : new DatabaseEntitlementSource(database)
    )
  )
}
