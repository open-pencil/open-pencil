import { describe, expect, test } from 'bun:test'

import { startTransactionalEmailWorker } from '@open-pencil/cloud/server'

describe('transactional email worker lifecycle', () => {
  test('runs sequentially and awaits an in-flight drain during shutdown', async () => {
    let calls = 0
    let concurrent = 0
    let maximumConcurrent = 0
    let releaseFirst: (() => void) | undefined
    const firstRun = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const worker = startTransactionalEmailWorker(
      {
        async enqueue() {
          return 'unused'
        },
        async deliverPending() {
          calls++
          concurrent++
          maximumConcurrent = Math.max(maximumConcurrent, concurrent)
          if (calls === 1) await firstRun
          concurrent--
          return { claimed: 0, accepted: 0, retrying: 0, failed: 0, suppressed: 0 }
        }
      },
      {
        batchSize: 1,
        intervalMs: 1000,
        leaseDurationMs: 1000,
        maximumAttempts: 1
      }
    )
    expect(calls).toBe(1)
    const stopped = worker.stop()
    await Promise.resolve()
    expect(concurrent).toBe(1)
    releaseFirst?.()
    await stopped
    expect(calls).toBe(1)
    expect(maximumConcurrent).toBe(1)
  })
})
