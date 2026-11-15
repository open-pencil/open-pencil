import type { CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import type { TransactionalEmailService } from '#cloud/server/email'
import type { CloudErrorReporter } from '#cloud/server/errors'
import type { ObjectStore } from '#cloud/server/objects'
import type { CloudPolicy } from '#cloud/server/policy/policy'
import { createStorageLimitNoticeService } from '#cloud/server/quota'
import { createRateLimitCleanupService } from '#cloud/server/rate-limit/cleanup'
import type { Kysely } from 'kysely'

import { createDocumentCleanupService } from './documents'
import { createRevisionCompactionService } from './revisions'
import { createUploadCleanupService } from './uploads'
import type { CleanupPassOptions, CleanupServices } from './worker'

/**
 * Every cleanup service, over a deployment's database and bucket. Each reports what it couldn't
 * clean through `reportError`, where a deployment tracks errors, and carries on with the rest.
 * With `email`, a deployment that sends mail, it also tells accounts their storage is full.
 */
export function createCleanupServices(
  config: Pick<CloudServerConfig, 'deployment' | 'publicURL' | 'billingEndpoint'>,
  database: Kysely<CloudDatabase>,
  objects: ObjectStore,
  policy: CloudPolicy,
  reportError?: CloudErrorReporter,
  email?: TransactionalEmailService
): CleanupServices {
  return {
    uploads: createUploadCleanupService(database, objects, reportError),
    documents: createDocumentCleanupService(database, objects, { reportError }),
    revisions: createRevisionCompactionService(database, objects, {
      policy,
      deploymentMode: config.deployment,
      reportError
    }),
    rateLimits: createRateLimitCleanupService(database),
    storageLimits: email
      ? createStorageLimitNoticeService(database, {
          policy,
          email,
          publicURL: config.publicURL,
          upgradable: config.billingEndpoint !== undefined,
          deploymentMode: config.deployment
        })
      : undefined
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
