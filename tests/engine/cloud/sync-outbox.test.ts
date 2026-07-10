import { describe, expect, test } from 'bun:test'

import { createMemoryOutbox } from '@/app/cloud/sync/outbox'
import { supersedePutCanvasJobs, type OutboxJob } from '@/app/cloud/sync/types'

describe('supersedePutCanvasJobs', () => {
  test('drops older putCanvas jobs for same canvas', () => {
    const jobs: OutboxJob[] = [
      {
        id: 'a',
        canvasId: 'c1',
        type: 'putCanvas',
        revision: 1,
        createdAt: 1,
        attempts: 0,
        nextAttemptAt: 1
      },
      {
        id: 'b',
        canvasId: 'c1',
        type: 'putThumb',
        revision: 1,
        createdAt: 2,
        attempts: 0,
        nextAttemptAt: 2
      },
      {
        id: 'c',
        canvasId: 'c2',
        type: 'putCanvas',
        revision: 3,
        createdAt: 3,
        attempts: 0,
        nextAttemptAt: 3
      }
    ]
    const next = supersedePutCanvasJobs(jobs, 'c1', 5)
    expect(next.map((j) => j.id).sort()).toEqual(['b', 'c'])
  })
})

describe('memory outbox', () => {
  test('enqueues and supersedes putCanvas', async () => {
    const outbox = createMemoryOutbox()
    await outbox.enqueue({ canvasId: 'c1', type: 'putCanvas', revision: 1 })
    await outbox.enqueue({ canvasId: 'c1', type: 'putCanvas', revision: 2 })
    const list = await outbox.list()
    expect(list.filter((j) => j.type === 'putCanvas')).toHaveLength(1)
    expect(list[0]?.revision).toBe(2)
  })
})
