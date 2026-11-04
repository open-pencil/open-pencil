import { createPostgresCloudDatabase } from '#cloud/runtime/postgres/database'
import {
  createBetterAuthAdapter,
  migrateCloudDatabase,
  type CloudServerConfig
} from '#cloud/server'

import { loadNodeCloudServerConfig } from './config'

/** The deployment's database, migrated to this version before anything uses it. */
export async function migratedNodeCloudDatabase(config: CloudServerConfig) {
  const database = createPostgresCloudDatabase({ connectionString: config.databaseURL })
  const auth = createBetterAuthAdapter(config, database)
  await migrateCloudDatabase(database, { run: auth.migrate, schemaVersion: auth.schemaVersion })
  return { database, auth }
}

export async function createMigratedNodeCloudDatabase(
  environment: Readonly<Record<string, string | undefined>>
): Promise<{
  config: CloudServerConfig
  database: ReturnType<typeof createPostgresCloudDatabase>
  auth: ReturnType<typeof createBetterAuthAdapter>
}> {
  const config = await loadNodeCloudServerConfig(environment)
  return { config, ...(await migratedNodeCloudDatabase(config)) }
}
