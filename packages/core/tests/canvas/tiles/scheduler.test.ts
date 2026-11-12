import { describe, expect, test } from 'bun:test'

import { TileScheduler, type TileJob } from '#core/canvas/renderer/tiles'

function job(x: number, priority: TileJob['priority'], options: Partial<TileJob> = {}): TileJob {
  return {
    key: { pageId: 'page', level: 1, x, y: 0 },
    navigationGeneration: 1,
    contentGeneration: 1,
    priority,
    fallbackAvailable: false,
    estimatedCost: 1,
    ...options
  }
}

describe('tile scheduler', () => {
  test('runs mandatory holes before visible refresh and overscan', () => {
    let clock = 0
    const scheduler = new TileScheduler({ budgetMs: 5, now: () => clock })
    scheduler.setGeneration(1, 1)
    scheduler.enqueue([job(2, 'overscan'), job(1, 'visible'), job(0, 'mandatory')])
    const order: number[] = []
    const metrics = scheduler.runFrame((item) => {
      order.push(item.key.x)
      clock += 2
      return { renderMs: 2, overBudget: false }
    })

    expect(order).toEqual([0, 1, 2])
    expect(metrics.mandatoryCompleted).toBe(1)
    expect(metrics.interruptibleCompleted).toBe(2)
  })

  test('stops interruptible work at the deadline', () => {
    let clock = 0
    const scheduler = new TileScheduler({ budgetMs: 4, now: () => clock })
    scheduler.setGeneration(1, 1)
    scheduler.enqueue([job(0, 'visible'), job(1, 'visible'), job(2, 'overscan')])
    const first = scheduler.runFrame(() => {
      clock += 3
      return { renderMs: 3, overBudget: false }
    })

    expect(first.interruptibleCompleted).toBe(2)
    expect(first.remaining).toBe(1)
    expect(scheduler.pending()).toBe(1)
  })

  test('runs one estimated over-budget fallback refresh and keeps later work queued', () => {
    let clock = 0
    const scheduler = new TileScheduler({ budgetMs: 5, now: () => clock })
    scheduler.setGeneration(1, 1)
    scheduler.enqueue([
      job(0, 'visible', { fallbackAvailable: true, estimatedCost: 10 }),
      job(1, 'visible', { fallbackAvailable: true, estimatedCost: 10 })
    ])
    const metrics = scheduler.runFrame(() => {
      clock += 8
      return { renderMs: 8, overBudget: true }
    })

    expect(metrics.interruptibleCompleted).toBe(1)
    expect(metrics.overBudgetJobs).toBe(1)
    expect(metrics.remaining).toBe(1)
  })

  test('spreads multiple mandatory holes across frames after an over-budget job', () => {
    let clock = 0
    const scheduler = new TileScheduler({ budgetMs: 5, now: () => clock })
    scheduler.setGeneration(1, 1)
    scheduler.enqueue([job(0, 'mandatory'), job(1, 'mandatory')])
    const metrics = scheduler.runFrame(() => {
      clock += 8
      return { renderMs: 8, overBudget: true }
    })

    expect(metrics.mandatoryCompleted).toBe(1)
    expect(metrics.remaining).toBe(1)
  })

  test('allows a mandatory visible hole and reports deadline overrun', () => {
    let clock = 0
    const scheduler = new TileScheduler({ budgetMs: 5, now: () => clock })
    scheduler.setGeneration(1, 1)
    scheduler.enqueue([job(0, 'mandatory', { estimatedCost: 12 })])
    const metrics = scheduler.runFrame(() => {
      clock += 12
      return { renderMs: 12, overBudget: true }
    })

    expect(metrics.mandatoryCompleted).toBe(1)
    expect(metrics.overBudgetJobs).toBe(1)
    expect(metrics.deadlineOverrunMs).toBe(7)
  })

  test('uses the measured deadline rather than an arbitrary cheap-job cap', () => {
    let now = 0
    const scheduler = new TileScheduler({ budgetMs: 5, maximumJobsPerFrame: 32, now: () => now })
    scheduler.setGeneration(1, 1)
    scheduler.enqueue(
      Array.from({ length: 40 }, (_, x) =>
        job(x, 'visible', { fallbackAvailable: true, estimatedCost: 0.2 })
      )
    )

    const metrics = scheduler.runFrame(() => {
      now += 0.2
      return { renderMs: 0.2, overBudget: false }
    })

    expect(metrics.interruptibleCompleted).toBe(24)
    expect(metrics.remaining).toBe(16)
    expect(metrics.deadlineOverrunMs).toBe(0)
  })
  test('clears queued work explicitly for same-generation structural replacement', () => {
    const scheduler = new TileScheduler({ budgetMs: 5, now: () => 0 })
    scheduler.setGeneration(1, 1)
    scheduler.enqueue([job(0, 'visible'), job(1, 'visible')])

    expect(scheduler.clear()).toBe(2)
    expect(scheduler.pending()).toBe(0)
  })

  test('cancels queued work from obsolete navigation generations', () => {
    const scheduler = new TileScheduler({ budgetMs: 5, now: () => 0 })
    scheduler.setGeneration(1, 1)
    scheduler.enqueue([job(0, 'visible'), job(1, 'visible')])
    expect(scheduler.setGeneration(2, 1)).toBe(2)

    expect(scheduler.pending()).toBe(0)
  })
})

test('a moving frame skips dear jobs ahead of an affordable one and keeps them queued', () => {
  const executed: string[] = []
  let time = 0
  const scheduler = new TileScheduler({ now: () => time, budgetMs: 2 })
  const job = (x: number, estimatedCost: number) => ({
    key: { pageId: 'page', level: 1, x, y: 0 },
    navigationGeneration: 0,
    contentGeneration: 0,
    priority: 'visible' as const,
    fallbackAvailable: true,
    estimatedCost
  })
  scheduler.enqueue([job(0, 20), job(1, 20), job(2, 3)])
  const metrics = scheduler.runFrame(
    (candidate) => {
      executed.push(`${candidate.key.x}`)
      time += candidate.estimatedCost
      return { renderMs: candidate.estimatedCost, overBudget: candidate.estimatedCost > 2 }
    },
    2,
    8
  )
  expect(executed).toEqual(['2'])
  expect(metrics.interruptibleCompleted).toBe(1)
  expect(metrics.skippedWithFallback).toBe(2)
  expect(scheduler.pending()).toBe(2)
})

test('a deferred job stays first and ends the frame', () => {
  let time = 0
  const scheduler = new TileScheduler({ now: () => time, budgetMs: 5 })
  const job = (x: number) => ({
    key: { pageId: 'page', level: 1, x, y: 0 },
    navigationGeneration: 0,
    contentGeneration: 0,
    priority: 'visible' as const,
    fallbackAvailable: true,
    estimatedCost: 1
  })
  scheduler.enqueue([job(0), job(1)])
  let calls = 0
  const first = scheduler.runFrame((candidate, remainingMs) => {
    calls++
    expect(remainingMs).toBeGreaterThan(0)
    time += 5
    return { renderMs: 5, overBudget: false, deferred: candidate.key.x === 0 }
  })
  expect(calls).toBe(1)
  expect(first.deferredJobs).toBe(1)
  expect(first.interruptibleCompleted).toBe(0)
  expect(scheduler.pending()).toBe(2)
  time = 0
  const second = scheduler.runFrame(() => {
    time += 1
    return { renderMs: 1, overBudget: false, deferred: false }
  })
  expect(second.interruptibleCompleted).toBe(2)
})
