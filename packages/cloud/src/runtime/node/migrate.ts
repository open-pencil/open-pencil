import { createPostgresCloudDatabase } from '#cloud/runtime/postgres/database'
import { createBetterAuthAdapter, migrateCloudDatabase } from '#cloud/server'

import { loadNodeCloudServerConfig } from './config'

const config = await loadNodeCloudServerConfig(process.env)
const database = createPostgresCloudDatabase({ connectionString: config.databaseURL })
try {
  const auth = createBetterAuthAdapter(config, database)
  await migrateCloudDatabase(database, { run: auth.migrate, schemaVersion: auth.schemaVersion })
} finally {
  await database.destroy()
}
