import { createPostgresCloudDatabase } from '#cloud/runtime/postgres/database'
import { createS3ObjectStore } from '#cloud/runtime/s3/objects'
import {
  cleanupPassOptions,
  createCleanupServices,
  createConfiguredCloudPolicy,
  runCleanup
} from '#cloud/server'

import { loadNodeCloudServerConfig } from './config'

const config = await loadNodeCloudServerConfig(process.env)
const database = createPostgresCloudDatabase({ connectionString: config.databaseURL })
const objects = createS3ObjectStore(config)
try {
  const policy = createConfiguredCloudPolicy(config, database)
  const result = await runCleanup(
    createCleanupServices(config, database, objects, policy),
    cleanupPassOptions(config)
  )
  console.log(JSON.stringify(result))
} finally {
  await database.destroy()
}
