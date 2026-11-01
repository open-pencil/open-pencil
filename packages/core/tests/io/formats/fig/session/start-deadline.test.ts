import { afterEach, describe, expect, test } from 'bun:test'

import { parseFigFileViaWorker } from '#core/io/formats/fig/read'
import type { FigSessionOpenRequest } from '#core/kiwi/fig/session/protocol'

/**
 * A parser worker whose script request stalls fires no `error` event, so opening a file used to
 * wait on it forever. The page now gives the worker a deadline to report `started`.
 */
const RealWorker = globalThis.Worker

class StubWorker {
  static instances: StubWorker[] = []
  static answerStarted = false
  terminated = false
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null

  constructor() {
    StubWorker.instances.push(this)
  }

  postMessage(request: FigSessionOpenRequest) {
    if (StubWorker.answerStarted) request.port.postMessage({ type: 'started' }, { transfer: [] })
  }

  terminate() {
    this.terminated = true
  }
}

/** How a promise stands after `ms`: its rejection message, `resolved`, or `pending`. */
async function settleWithin(promise: Promise<unknown>, ms: number): Promise<string> {
  return Promise.race([
    promise.then(
      () => 'resolved',
      (error: Error) => error.message
    ),
    new Promise<string>((resolve) => {
      setTimeout(() => resolve('pending'), ms)
    })
  ])
}

function useStubWorker(answerStarted: boolean) {
  StubWorker.instances = []
  StubWorker.answerStarted = answerStarted
  Object.assign(globalThis, { Worker: StubWorker })
}

afterEach(() => {
  globalThis.Worker = RealWorker
})

describe('fig parser worker start deadline', () => {
  test('a worker that never starts is terminated and rejected so the caller can fall back', async () => {
    useStubWorker(false)
    const outcome = await settleWithin(
      parseFigFileViaWorker(new ArrayBuffer(8), { populate: 'first-page' }, 30),
      1000
    )
    expect(outcome).toContain('did not start within 30 ms')
    expect(StubWorker.instances).toHaveLength(1)
    expect(StubWorker.instances[0]?.terminated).toBe(true)
  })

  test('a worker that has started may take longer than the deadline to parse', async () => {
    useStubWorker(true)
    const controller = new AbortController()
    const parsing = parseFigFileViaWorker(
      new ArrayBuffer(8),
      { populate: 'first-page', signal: controller.signal },
      30
    )
    const outcome = await settleWithin(parsing, 150)
    expect(outcome).toBe('pending')
    controller.abort()
    await expect(parsing).rejects.toThrow('Aborted')
    expect(StubWorker.instances[0]?.terminated).toBe(true)
  })
})
