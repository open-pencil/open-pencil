import {
  cloudServerConfigFromEnvironment,
  createBetterAuthAdapter,
  migrateCloudDatabase
} from '#cloud/server'

import { createNodeCloudDatabase } from './database'

const config = cloudServerConfigFromEnvironment(process.env)
const database = createNodeCloudDatabase({ connectionString: config.databaseURL })
try {
  await migrateCloudDatabase(database, createBetterAuthAdapter(config, database).migrate)
} finally {
  await database.destroy()
}
