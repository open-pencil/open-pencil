import {
  cloudServerConfigFromEnvironment,
  createCloudAuth,
  migrateCloudDatabase
} from '#cloud/server'

import { createNodeCloudDatabase } from './database'

const config = cloudServerConfigFromEnvironment(process.env)
const database = createNodeCloudDatabase({ connectionString: config.databaseURL })
try {
  await migrateCloudDatabase(database, createCloudAuth(config, database))
} finally {
  await database.destroy()
}
