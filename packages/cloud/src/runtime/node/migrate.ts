import {
  cloudServerConfigFromEnvironment,
  createBetterAuthAdapter,
  migrateCloudDatabase
} from '#cloud/server'

import { createNodeCloudDatabase } from './database'

const config = cloudServerConfigFromEnvironment(process.env)
const database = createNodeCloudDatabase({ connectionString: config.databaseURL })
try {
  const auth = createBetterAuthAdapter(config, database)
  await migrateCloudDatabase(database, { run: auth.migrate, schemaVersion: auth.schemaVersion })
} finally {
  await database.destroy()
}
