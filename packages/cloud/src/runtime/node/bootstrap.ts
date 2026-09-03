import {
  cloudServerConfigFromEnvironment,
  createBetterAuthAdapter,
  migrateCloudDatabase,
  type CloudServerConfig
} from '#cloud/server'

import { loadNodeCloudServerConfig } from './config'
import { createNodeCloudDatabase } from './database'

export async function createMigratedNodeCloudDatabase(
  environment: Readonly<Record<string, string | undefined>>
): Promise<{
  config: CloudServerConfig
  database: ReturnType<typeof createNodeCloudDatabase>
  auth: ReturnType<typeof createBetterAuthAdapter>
}> {
  const config =
    (await loadNodeCloudServerConfig(environment)) ?? cloudServerConfigFromEnvironment(environment)
  const database = createNodeCloudDatabase({ connectionString: config.databaseURL })
  const auth = createBetterAuthAdapter(config, database)
  await migrateCloudDatabase(database, { run: auth.migrate, schemaVersion: auth.schemaVersion })
  return { config, database, auth }
}
