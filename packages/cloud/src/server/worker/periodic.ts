import { waitForWorkerInterval } from './interval'

export type PeriodicWorkerOptions<Result> = {
  intervalMs: number
  run(): Promise<Result>
  signal?: AbortSignal
  onError?: (error: unknown) => void
}

export type PeriodicWorker<Result> = {
  runOnce(): Promise<Result>
  stop(): Promise<void>
}

export function startPeriodicWorker<Result>(
  options: PeriodicWorkerOptions<Result>
): PeriodicWorker<Result> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  options.signal?.addEventListener('abort', abort, { once: true })

  async function loop(): Promise<void> {
    while (!controller.signal.aborted) {
      try {
        await options.run()
      } catch (error) {
        options.onError?.(error)
      }
      await waitForWorkerInterval(options.intervalMs, controller.signal)
    }
  }

  const running = loop()
  return {
    runOnce: () => options.run(),
    async stop() {
      controller.abort()
      options.signal?.removeEventListener('abort', abort)
      await running
    }
  }
}
