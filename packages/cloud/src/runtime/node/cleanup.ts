import {
  cloudServerConfigFromEnvironment,
  createDocumentCleanupService,
  createUploadCleanupService
} from '#cloud/server'

import { createS3ObjectStore } from '../s3/objects'
import { createNodeCloudDatabase } from './database'

const config = cloudServerConfigFromEnvironment(process.env)
const database = createNodeCloudDatabase({ connectionString: config.databaseURL })
const objects = createS3ObjectStore(config)
try {
  const uploads = await createUploadCleanupService(database, objects).cleanupExpiredUploads({
    batchSize: config.cleanupBatchSize,
    leaseDurationMs: config.cleanupLeaseDurationMs
  })
  const documents = await createDocumentCleanupService(database, objects).cleanupDeletedDocuments({
    batchSize: config.cleanupBatchSize,
    leaseDurationMs: config.cleanupLeaseDurationMs,
    retentionMs: config.documentRetentionMs
  })
  console.log(JSON.stringify({ uploads, documents }))
} finally {
  await database.destroy()
}
