import { describe, expect, test } from 'bun:test'

import { memoryStateStore, until } from '#cloud-tests/helpers/relay'
import { openRoomLog } from '#cloud/server/collaboration/relay/log'
import type * as Y from 'yjs'

const room = { documentId: crypto.randomUUID(), roomEpoch: 0 }
const limits = { updates: 3, bytes: 1 << 20 }

async function openLog(store = memoryStateStore().store, logLimits = limits) {
  return { ...(await openRoomLog(store, room, logLimits)), store }
}

function type(document: Y.Doc, text: string) {
  document.getText('t').insert(document.getText('t').length, text)
}

describe('room log', () => {
  test('logs the updates of one save as one merged update', async () => {
    const { document, log, store } = await openLog()
    type(document, 'a')
    type(document, 'b')
    await log.save()
    const saved = await store.load(room)
    expect(saved).toMatchObject({ snapshot: null, sequence: 1 })
    expect(saved.updates).toHaveLength(1)
    // Nothing new to save writes nothing.
    await log.save()
    expect((await store.load(room)).sequence).toBe(1)
  })

  test('folds the log into a snapshot at its limit and as the room closes', async () => {
    const { document, log, store } = await openLog()
    for (const text of ['a', 'b', 'c']) {
      type(document, text)
      await log.save()
    }
    type(document, 'd')
    await log.save()
    expect(await store.load(room)).toMatchObject({ updates: [], sequence: 3 })

    type(document, 'e')
    await log.save()
    expect((await store.load(room)).updates).toHaveLength(1)
    await log.save({ closing: true })
    const closed = await store.load(room)
    expect(closed.updates).toEqual([])

    const reopened = await openRoomLog(store, room, limits)
    expect(reopened.document.getText('t').toString()).toBe('abcde')
  })

  test('keeps a refused save for the next one, which writes a snapshot', async () => {
    const memory = memoryStateStore()
    let refuse = true
    const { document, log } = await openLog({
      ...memory.store,
      async append(identity, sequence, update) {
        if (refuse) throw new Error('Database unavailable')
        await memory.store.append(identity, sequence, update)
      }
    })
    type(document, 'a')
    await expect(log.save()).rejects.toThrow('Database unavailable')
    refuse = false
    type(document, 'b')
    await log.save()
    const saved = await memory.store.load(room)
    expect(saved.updates).toEqual([])
    expect(saved.snapshot).not.toBeNull()
    expect((await openRoomLog(memory.store, room, limits)).document.getText('t').toString()).toBe(
      'ab'
    )
  })

  test('covers an append whose result is unknown, so the next append takes a fresh sequence', async () => {
    const memory = memoryStateStore()
    let lose = true
    const { document, log } = await openLog({
      ...memory.store,
      // The row lands, but the answer is lost.
      async append(identity, sequence, update) {
        await memory.store.append(identity, sequence, update)
        if (lose) {
          lose = false
          throw new Error('Connection reset')
        }
      }
    })
    type(document, 'a')
    await expect(log.save()).rejects.toThrow('Connection reset')
    type(document, 'b')
    await log.save()
    type(document, 'c')
    await log.save()
    const saved = await memory.store.load(room)
    expect(saved.sequence).toBe(2)
    expect(saved.updates).toHaveLength(1)
    expect((await openRoomLog(memory.store, room, limits)).document.getText('t').toString()).toBe(
      'abc'
    )
  })

  test('runs one save at a time, so two never claim one sequence', async () => {
    const memory = memoryStateStore()
    let release: (() => void) | undefined
    const sequences: number[] = []
    const { document, log } = await openLog({
      ...memory.store,
      async append(identity, sequence, update) {
        sequences.push(sequence)
        if (sequence === 1) {
          await new Promise<void>((resolve) => {
            release = resolve
          })
        }
        await memory.store.append(identity, sequence, update)
      }
    })
    type(document, 'a')
    const first = log.save()
    await until(() => release !== undefined)
    // An edit after the first save took its batch, saved while that one is still writing.
    type(document, 'b')
    const second = log.save()
    await Bun.sleep(5)
    expect(sequences).toEqual([1])
    release?.()
    await Promise.all([first, second])
    expect(sequences).toEqual([1, 2])
    const reopened = await openRoomLog(memory.store, room, limits)
    expect(reopened.document.getText('t').toString()).toBe('ab')
  })
})
