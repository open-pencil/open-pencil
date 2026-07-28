import { describe, expect, test } from 'bun:test'

import { nextSyncWakeDelay } from '@/app/storage/sync/engine'
import { createMemoryOutbox } from '@/app/storage/sync/outbox'
import { supersedePutCanvasJobs, type OutboxJob } from '@/app/storage/sync/types'

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

describe('sync wake scheduling', () => {
  test('does not poll jobs parked for repaired configuration', () => {
    const parked: OutboxJob = {
      id: 'parked',
      canvasId: 'c1',
      type: 'putCanvas',
      revision: 1,
      createdAt: 1,
      attempts: 0,
      nextAttemptAt: Number.MAX_SAFE_INTEGER
    }
    expect(nextSyncWakeDelay([parked], 100)).toBeNull()
    expect(nextSyncWakeDelay([{ ...parked, nextAttemptAt: 500 }], 100)).toBe(400)
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
