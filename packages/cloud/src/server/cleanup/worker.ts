import type { DocumentCleanupResult, DocumentCleanupService } from './documents'
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
}

export type CleanupServices = {
  documents: DocumentCleanupService
  uploads: UploadCleanupService
}

export type CleanupWorker = {
  runOnce(): Promise<CleanupResult>
  stop(): Promise<void>
}

export function startCleanupWorker(
  cleanup: CleanupServices,
  options: CleanupWorkerOptions
): CleanupWorker {
  const controller = new AbortController()
  const abort = () => controller.abort()
  options.signal?.addEventListener('abort', abort, { once: true })

  async function runOnce(): Promise<CleanupResult> {
    const uploads = await cleanup.uploads.cleanupExpiredUploads({
      batchSize: options.batchSize,
      leaseDurationMs: options.leaseDurationMs
    })
    const documents = await cleanup.documents.cleanupDeletedDocuments({
      batchSize: options.batchSize,
      leaseDurationMs: options.leaseDurationMs,
      retentionMs: options.documentRetentionMs
    })
    return { uploads, documents }
  }

  async function loop(): Promise<void> {
    while (!controller.signal.aborted) {
      try {
        await runOnce()
      } catch (error) {
        options.onError?.(error)
      }
      await waitForInterval(options.intervalMs, controller.signal)
    }
  }

  const running = loop()
  return {
    runOnce,
    async stop() {
      controller.abort()
      options.signal?.removeEventListener('abort', abort)
      await running
    }
  }
}

function waitForInterval(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    const timer = setTimeout(finish, milliseconds)
    signal.addEventListener('abort', finish, { once: true })
  })
}
