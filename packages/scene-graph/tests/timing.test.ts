import { describe, expect, test } from 'bun:test'

import {
  anySignal,
  backoffDelay,
  isDeadline,
  sleep,
  untilAborted,
  withDeadline
} from '@open-pencil/scene-graph/timing'

describe('withDeadline', () => {
  test('answers with the work when it finishes in time', async () => {
    expect(await withDeadline(1_000, async () => 'done')).toBe('done')
  })

  test('aborts the work it bounds when the deadline passes, and says it was the deadline', async () => {
    let seen: AbortSignal | undefined
    const failure = await withDeadline(10, (signal) => {
      seen = signal
      return new Promise<never>(() => {
        // Never settles: only the deadline ends it.
      })
    }).catch((error: unknown) => error)
    expect(isDeadline(failure)).toBe(true)
    expect(seen?.aborted).toBe(true)
  })

  test('rejects with the caller’s reason when the caller aborts first', async () => {
    const caller = new AbortController()
    const never = () =>
      new Promise<never>(() => {
        // Never settles: only the caller's abort ends it.
      })
    const pending = withDeadline(1_000, never, caller.signal)
    caller.abort(new Error('closed'))
    await expect(pending).rejects.toThrow('closed')
  })
})

describe('anySignal', () => {
  test('aborts with the reason of whichever signal aborts first', () => {
    const first = new AbortController()
    const second = new AbortController()
    const any = anySignal([first.signal, undefined, second.signal])
    second.abort(new Error('second'))
    expect(any.aborted).toBe(true)
    expect(any.reason).toEqual(new Error('second'))
  })
})

describe('untilAborted', () => {
  test('rejects at once for a signal that already aborted', async () => {
    const controller = new AbortController()
    controller.abort(new Error('gone'))
    await expect(untilAborted(Promise.resolve(1), controller.signal)).rejects.toThrow('gone')
  })
})

describe('sleep', () => {
  test('waits, or stops when its signal aborts', async () => {
    await sleep(1)
    const controller = new AbortController()
    const waiting = sleep(1_000, controller.signal)
    controller.abort(new Error('stop'))
    await expect(waiting).rejects.toThrow('stop')
  })
})

describe('backoffDelay', () => {
  const backoff = { baseMs: 100, capMs: 1_000, jitter: false }

  test('doubles from the base up to the cap', () => {
    expect([0, 1, 2, 3, 4, 10].map((attempt) => backoffDelay(attempt, backoff))).toEqual([
      100, 200, 400, 800, 1_000, 1_000
    ])
  })

  test('with jitter, waits between half and all of the delay', () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const full = backoffDelay(attempt, backoff)
      const jittered = backoffDelay(attempt, { ...backoff, jitter: true })
      expect(jittered).toBeGreaterThanOrEqual(full / 2)
      expect(jittered).toBeLessThanOrEqual(full)
    }
  })
})
