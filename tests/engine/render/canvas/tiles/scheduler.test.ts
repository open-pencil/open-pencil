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

  test('cancels queued work from obsolete navigation generations', () => {
    const scheduler = new TileScheduler({ budgetMs: 5, now: () => 0 })
    scheduler.setGeneration(1, 1)
    scheduler.enqueue([job(0, 'visible'), job(1, 'visible')])
    scheduler.setGeneration(2, 1)

    expect(scheduler.pending()).toBe(0)
  })
})
