import { getLocalCanvasStore } from '@/app/storage/local-store'
import { getOutbox } from '@/app/storage/sync/outbox'

export type CloudConnectionWorkSummary = {
  pendingDocuments: number
  conflictingDocuments: number
  failedDocuments: number
  queuedJobs: number
}

export async function cloudConnectionWorkSummary(
  connectionId: string
): Promise<CloudConnectionWorkSummary> {
  const documents = (await getLocalCanvasStore().listMetas(true)).filter(
    (metadata) => metadata.connectionId === connectionId
  )
  const canvasIds = new Set(documents.map((document) => document.id))
  const jobs = (await getOutbox().list()).filter((job) => canvasIds.has(job.canvasId))
  return {
    pendingDocuments: documents.filter((document) => document.syncStatus === 'pending').length,
    conflictingDocuments: documents.filter((document) => document.syncStatus === 'conflict').length,
    failedDocuments: documents.filter((document) => document.syncStatus === 'error').length,
    queuedJobs: jobs.length
  }
}

export function hasPendingCloudConnectionWork(summary: CloudConnectionWorkSummary): boolean {
  return (
    summary.pendingDocuments > 0 ||
    summary.conflictingDocuments > 0 ||
    summary.failedDocuments > 0 ||
    summary.queuedJobs > 0
  )
}
