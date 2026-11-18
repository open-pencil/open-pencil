import { createPostgresCloudDatabase } from '#cloud/runtime/postgres/database'
import { createCloudErrorReporter } from '#cloud/runtime/posthog/errors'
import { createS3ObjectStore } from '#cloud/runtime/s3/objects'
import {
  cleanupPassOptions,
  createCleanupServices,
  createConfiguredCloudPolicy,
  createLoggingErrorReporter,
  runCleanup,
  writeJSONLine
} from '#cloud/server'

import { loadNodeCloudServerConfig } from './config'
import { createNodeTransactionalEmailRuntime } from './email/runtime'

const config = await loadNodeCloudServerConfig(process.env)
// A sweep may take longer than a request should.
const database = createPostgresCloudDatabase({
  connectionString: config.databaseURL,
  statementTimeoutMs: null
})
const objects = createS3ObjectStore(config)
try {
  const policy = createConfiguredCloudPolicy(config, database)
  // Queued here, sent by the server's email worker.
  const { email, transport } = createNodeTransactionalEmailRuntime(config, database)
  const result = await runCleanup(
    createCleanupServices(
      config,
      database,
      objects,
      policy,
      createLoggingErrorReporter(writeJSONLine, createCloudErrorReporter(config, 'node')),
      transport ? email : undefined
    ),
    cleanupPassOptions(config)
  )
  console.log(JSON.stringify(result))
} finally {
  await database.destroy()
}
