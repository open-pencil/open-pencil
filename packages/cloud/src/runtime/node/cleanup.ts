import { createS3ObjectStore } from '#cloud/runtime/s3/objects'
import {
  createDefaultCloudPolicy,
  createDocumentCleanupService,
  createRevisionCompactionService,
  createUploadCleanupService,
  DatabaseEntitlementSource,
  EntitlementOpenFeatureProvider,
  REVISION_COMPACTION_GRACE_MS,
  StaticEntitlementSource,
  staticEntitlementValues
} from '#cloud/server'

import { loadNodeCloudServerConfig } from './config'
import { createNodeCloudDatabase } from './database'

const config = await loadNodeCloudServerConfig(process.env)
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
  const policy = createDefaultCloudPolicy(
    new EntitlementOpenFeatureProvider(
      config.staticEntitlements
        ? new StaticEntitlementSource(staticEntitlementValues(config.staticEntitlements))
        : new DatabaseEntitlementSource(database)
    )
  )
  const revisions = await createRevisionCompactionService(database, objects, {
    policy,
    deploymentMode: config.deployment
  }).compactRevisions({ batchSize: config.cleanupBatchSize, graceMs: REVISION_COMPACTION_GRACE_MS })
  console.log(JSON.stringify({ uploads, documents, revisions }))
} finally {
  await database.destroy()
}
