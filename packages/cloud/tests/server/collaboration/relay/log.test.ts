import { describe, expect, test } from 'bun:test'

import { memoryStateStore } from '#cloud-tests/helpers/relay'
import { openRoomLog } from '#cloud/server/collaboration/relay/log'
import type * as Y from 'yjs'

const room = { documentId: crypto.randomUUID(), roomEpoch: 0 }
const limits = { updates: 3, bytes: 1 << 20 }

/** A room log whose document records its own updates, as the relay wires them. */
async function openLog(store = memoryStateStore().store, logLimits = limits) {
  const opened = await openRoomLog(store, room, logLimits)
  opened.document.on('update', (update: Uint8Array) => opened.log.record(update))
  return { ...opened, store }
}

function type(document: Y.Doc, text: string) {
  document.getText('t').insert(document.getText('t').length, text)
}

describe('room log', () => {
  test('logs the updates of one save as one merged update', async () => {
    const { document, log, store } = await openLog()
    type(document, 'a')
    type(document, 'b')
    await log.save(document)
    const saved = await store.load(room)
    expect(saved).toMatchObject({ snapshot: null, sequence: 1 })
    expect(saved.updates).toHaveLength(1)
    // Nothing new to save writes nothing.
    await log.save(document)
    expect((await store.load(room)).sequence).toBe(1)
  })

  test('folds the log into a snapshot at its limit and as the room closes', async () => {
    const { document, log, store } = await openLog()
    for (const text of ['a', 'b', 'c']) {
      type(document, text)
      await log.save(document)
    }
    type(document, 'd')
    await log.save(document)
    expect(await store.load(room)).toMatchObject({ updates: [], sequence: 3 })

    type(document, 'e')
    await log.save(document)
    expect((await store.load(room)).updates).toHaveLength(1)
    await log.save(document, { closing: true })
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
    await expect(log.save(document)).rejects.toThrow('Database unavailable')
    refuse = false
    type(document, 'b')
    await log.save(document)
    const saved = await memory.store.load(room)
    expect(saved.updates).toEqual([])
    expect(saved.snapshot).not.toBeNull()
    expect((await openRoomLog(memory.store, room, limits)).document.getText('t').toString()).toBe(
      'ab'
    )
  })
})
