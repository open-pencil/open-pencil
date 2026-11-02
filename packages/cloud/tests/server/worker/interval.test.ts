import { describe, expect, test } from 'bun:test'

import { waitForWorkerInterval } from '#cloud/server/worker/interval'

describe('worker interval', () => {
  test('waits for the interval', async () => {
    const started = performance.now()
    await waitForWorkerInterval(20, new AbortController().signal)
    expect(performance.now() - started).toBeGreaterThanOrEqual(15)
  })

  test('ends as soon as the worker stops', async () => {
    const controller = new AbortController()
    const waiting = waitForWorkerInterval(60_000, controller.signal)
    controller.abort()
    await waiting
    await waitForWorkerInterval(60_000, controller.signal)
  })
})
