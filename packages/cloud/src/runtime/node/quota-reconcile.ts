import {
  cloudServerConfigFromEnvironment,
  createCloudAuth,
  createStorageReconciliationService,
  migrateCloudDatabase
} from '#cloud/server'

import { loadNodeCloudServerConfig } from './config'
import { createNodeCloudDatabase } from './database'

const environment = process.env
const config =
  (await loadNodeCloudServerConfig(environment)) ?? cloudServerConfigFromEnvironment(environment)
const database = createNodeCloudDatabase({ connectionString: config.databaseURL })
const auth = createCloudAuth(config, database)
await migrateCloudDatabase(database, auth)
try {
  const dryRun = process.argv.includes('--dry-run')
  const results = await createStorageReconciliationService(database).reconcile({ dryRun })
  console.log(JSON.stringify({ dryRun, results }))
} finally {
  await database.destroy()
}
