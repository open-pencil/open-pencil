import { createPostgresCloudDatabase } from '#cloud/runtime/postgres/database'
import { createBetterAuthAdapter, migrateCloudDatabase } from '#cloud/server'

import { loadNodeCloudServerConfig } from './config'

const config = await loadNodeCloudServerConfig(process.env)
// A migration may rewrite a large table, which takes as long as it takes.
const database = createPostgresCloudDatabase({
  connectionString: config.databaseURL,
  queryTimeoutMs: null
})
try {
  const auth = createBetterAuthAdapter(config, database)
  await migrateCloudDatabase(database, { run: auth.migrate, schemaVersion: auth.schemaVersion })
} finally {
  await database.destroy()
}
