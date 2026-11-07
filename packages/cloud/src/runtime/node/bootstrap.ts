import { createPostgresCloudDatabase } from '#cloud/runtime/postgres/database'
import {
  createBetterAuthAdapter,
  migrateCloudDatabase,
  type CloudServerConfig
} from '#cloud/server'

import { loadNodeCloudServerConfig } from './config'

/**
 * The deployment's database, migrated to this version before anything uses it. Migrations run
 * on a connection of their own without the query timeout, since one may rewrite a large table.
 */
export async function migratedNodeCloudDatabase(config: CloudServerConfig) {
  const migrating = createPostgresCloudDatabase({
    connectionString: config.databaseURL,
    queryTimeoutMs: null
  })
  try {
    const auth = createBetterAuthAdapter(config, migrating)
    await migrateCloudDatabase(migrating, { run: auth.migrate, schemaVersion: auth.schemaVersion })
  } finally {
    await migrating.destroy()
  }
  const database = createPostgresCloudDatabase({ connectionString: config.databaseURL })
  return { database, auth: createBetterAuthAdapter(config, database) }
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
