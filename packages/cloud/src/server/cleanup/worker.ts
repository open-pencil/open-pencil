import type { UploadCleanupResult, UploadCleanupService } from './uploads'

export type CleanupWorkerOptions = {
  batchSize: number
  intervalMs: number
  leaseDurationMs: number
  signal?: AbortSignal
  onError?: (error: unknown) => void
}

export type CleanupWorker = {
  runOnce(): Promise<UploadCleanupResult>
  stop(): Promise<void>
}

export function startCleanupWorker(
  cleanup: UploadCleanupService,
  options: CleanupWorkerOptions
): CleanupWorker {
  const controller = new AbortController()
  const abort = () => controller.abort()
  options.signal?.addEventListener('abort', abort, { once: true })
  let running: Promise<void> | undefined

  async function runOnce(): Promise<UploadCleanupResult> {
    return cleanup.cleanupExpiredUploads({
      batchSize: options.batchSize,
      leaseDurationMs: options.leaseDurationMs
    })
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

  running = loop()
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
    const timer = setTimeout(done, milliseconds)
    signal.addEventListener('abort', done, { once: true })
    function done() {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
  })
}
