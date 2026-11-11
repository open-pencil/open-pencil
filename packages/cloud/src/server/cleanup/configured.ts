import type { CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import type { CloudErrorReporter } from '#cloud/server/errors'
import type { ObjectStore } from '#cloud/server/objects'
import type { CloudPolicy } from '#cloud/server/policy/policy'
import { createRateLimitCleanupService } from '#cloud/server/rate-limit/cleanup'
import type { Kysely } from 'kysely'

import { createDocumentCleanupService } from './documents'
import { createRevisionCompactionService } from './revisions'
import { createUploadCleanupService } from './uploads'
import type { CleanupPassOptions, CleanupServices } from './worker'

/**
 * Every cleanup service, over a deployment's database and bucket. Each reports what it couldn't
 * clean through `reportError`, where a deployment tracks errors, and carries on with the rest.
 */
export function createCleanupServices(
  config: Pick<CloudServerConfig, 'deployment'>,
  database: Kysely<CloudDatabase>,
  objects: ObjectStore,
  policy: CloudPolicy,
  reportError?: CloudErrorReporter
): CleanupServices {
  return {
    uploads: createUploadCleanupService(database, objects, reportError),
    documents: createDocumentCleanupService(database, objects, { reportError }),
    revisions: createRevisionCompactionService(database, objects, {
      policy,
      deploymentMode: config.deployment,
      reportError
    }),
    rateLimits: createRateLimitCleanupService(database)
  }
}

/** The batch, lease, and retention a deployment sets for each cleanup pass. */
export function cleanupPassOptions(config: CloudServerConfig): CleanupPassOptions {
  return {
    batchSize: config.cleanupBatchSize,
    documentRetentionMs: config.documentRetentionMs,
    documentPurgeGraceMs: config.documentPurgeGraceMs,
    leaseDurationMs: config.cleanupLeaseDurationMs
  }
}
