import { startPeriodicWorker } from '../worker/periodic'
import type { TransactionalEmailDeliveryResult, TransactionalEmailService } from './types'

export type TransactionalEmailWorkerOptions = {
  batchSize: number
  intervalMs: number
  leaseDurationMs: number
  maximumAttempts: number
  signal?: AbortSignal
  onError?: (error: unknown) => void
}

export type TransactionalEmailWorker = {
  runOnce(): Promise<TransactionalEmailDeliveryResult>
  stop(): Promise<void>
}

export function startTransactionalEmailWorker(
  email: TransactionalEmailService,
  options: TransactionalEmailWorkerOptions
): TransactionalEmailWorker {
  return startPeriodicWorker({
    intervalMs: options.intervalMs,
    signal: options.signal,
    onError: options.onError,
    run: () =>
      email.deliverPending({
        batchSize: options.batchSize,
        leaseDurationMs: options.leaseDurationMs,
        maximumAttempts: options.maximumAttempts
      })
  })
}
