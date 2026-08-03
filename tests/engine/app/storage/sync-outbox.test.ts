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

describe('supersession is partitioned by destination', () => {
  /**
   * Queueing an upload for one bucket used to discard one already owed to
   * another: the filter matched on canvas and revision alone. The bytes owed to
   * the first destination were then never sent, and nothing recorded that they
   * had been dropped.
   */
  const job = (targetId: string | null, revision: number): OutboxJob => ({
    id: `${targetId}-${revision}`,
    canvasId: 'doc',
    type: 'putCanvas',
    revision,
    targetId,
    createdAt: 0,
    attempts: 0,
    nextAttemptAt: 0
  })

  test('keeps work owed to a different target', () => {
    const queue = [job('s3#aaaa', 1)]

    const next = supersedePutCanvasJobs(queue, 'doc', 1, 's3#bbbb')

    expect(next).toHaveLength(1)
    expect(next[0]?.targetId).toBe('s3#aaaa')
  })

  test('still supersedes an older job for the same target', () => {
    const queue = [job('s3#aaaa', 1)]

    expect(supersedePutCanvasJobs(queue, 'doc', 2, 's3#aaaa')).toHaveLength(0)
  })

  test('treats local-only work as its own partition', () => {
    const queue = [job(null, 1)]

    expect(supersedePutCanvasJobs(queue, 'doc', 1, 's3#aaaa')).toHaveLength(1)
  })
})
