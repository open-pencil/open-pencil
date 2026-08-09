import { describe, expect, test } from 'bun:test'

import {
  LatestFirstScheduler,
  ScheduledTaskCancelledError
} from '@/app/editor/thumbnails/scheduler'

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

describe('thumbnail render scheduler', () => {
  test('runs one task at a time and prefers the newest queued request', async () => {
    const scheduler = new LatestFirstScheduler<string>()
    const first = deferred<string>()
    const order: string[] = []

    const firstResult = scheduler.schedule(async () => {
      order.push('first')
      return first.promise
    })
    await Promise.resolve()

    const secondResult = scheduler.schedule(async () => {
      order.push('second')
      return 'second'
    })
    const thirdResult = scheduler.schedule(async () => {
      order.push('third')
      return 'third'
    })
    await Promise.resolve()
    expect(order).toEqual(['first'])

    first.resolve('first')
    await expect(firstResult).resolves.toBe('first')
    await expect(thirdResult).resolves.toBe('third')
    await expect(secondResult).resolves.toBe('second')
    expect(order).toEqual(['first', 'third', 'second'])
  })

  test('holds queued work while paused', async () => {
    const scheduler = new LatestFirstScheduler<string>()
    const order: string[] = []
    scheduler.setPaused(true)

    const result = scheduler.schedule(async () => {
      order.push('run')
      return 'done'
    })
    await Promise.resolve()
    expect(order).toEqual([])

    scheduler.setPaused(false)
    await expect(result).resolves.toBe('done')
    expect(order).toEqual(['run'])
  })

  test('drops queued work when its caller aborts', async () => {
    const scheduler = new LatestFirstScheduler<string>()
    const first = deferred<string>()
    const controller = new AbortController()
    const order: string[] = []

    const firstResult = scheduler.schedule(() => first.promise)
    await Promise.resolve()
    const cancelled = scheduler.schedule(async () => {
      order.push('cancelled')
      return 'cancelled'
    }, controller.signal)

    controller.abort()
    await expect(cancelled).rejects.toBeInstanceOf(ScheduledTaskCancelledError)
    first.resolve('first')
    await expect(firstResult).resolves.toBe('first')
    expect(order).toEqual([])
  })
})
