import {
  cloudServerConfigFromEnvironment,
  createCloudAuth,
  migrateCloudDatabase
} from '#cloud/server'

import { loadNodeCloudServerConfig } from './config'
import { createNodeCloudDatabase } from './database'

export async function withNodeCloudDatabase<T>(
  operation: (database: ReturnType<typeof createNodeCloudDatabase>) => Promise<T>
): Promise<T> {
  const environment = process.env
  const config =
    (await loadNodeCloudServerConfig(environment)) ?? cloudServerConfigFromEnvironment(environment)
  const database = createNodeCloudDatabase({ connectionString: config.databaseURL })
  const auth = createCloudAuth(config, database)
  await migrateCloudDatabase(database, auth)
  try {
    return await operation(database)
  } finally {
    await database.destroy()
  }
}
