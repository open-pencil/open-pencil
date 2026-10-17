import { startPeriodicWorker } from '../worker/periodic'
import type { DocumentCleanupResult, DocumentCleanupService } from './documents'
import {
  REVISION_COMPACTION_GRACE_MS,
  type RevisionCompactionResult,
  type RevisionCompactionService
} from './revisions'
import type { UploadCleanupResult, UploadCleanupService } from './uploads'

export type CleanupWorkerOptions = {
  batchSize: number
  documentRetentionMs: number
  intervalMs: number
  leaseDurationMs: number
  signal?: AbortSignal
  onError?: (error: unknown) => void
}

export type CleanupResult = {
  uploads: UploadCleanupResult
  documents: DocumentCleanupResult
  revisions: RevisionCompactionResult | null
  rateLimits: number
}

export type CleanupServices = {
  documents: DocumentCleanupService
  uploads: UploadCleanupService
  revisions?: RevisionCompactionService
  rateLimits?: { cleanupExpired(before: Date): Promise<number> }
}

export type CleanupWorker = {
  runOnce(): Promise<CleanupResult>
  stop(): Promise<void>
}

export function startCleanupWorker(
  cleanup: CleanupServices,
  options: CleanupWorkerOptions
): CleanupWorker {
  return startPeriodicWorker({
    intervalMs: options.intervalMs,
    signal: options.signal,
    onError: options.onError,
    async run() {
      const uploads = await cleanup.uploads.cleanupExpiredUploads({
        batchSize: options.batchSize,
        leaseDurationMs: options.leaseDurationMs
      })
      const documents = await cleanup.documents.cleanupDeletedDocuments({
        batchSize: options.batchSize,
        leaseDurationMs: options.leaseDurationMs,
        retentionMs: options.documentRetentionMs
      })
      const revisions = cleanup.revisions
        ? await cleanup.revisions.compactRevisions({
            batchSize: options.batchSize,
            graceMs: REVISION_COMPACTION_GRACE_MS
          })
        : null
      const rateLimits = cleanup.rateLimits
        ? await cleanup.rateLimits.cleanupExpired(new Date(Date.now() - 24 * 60 * 60_000))
        : 0
      return { uploads, documents, revisions, rateLimits }
    }
  })
}
