import { describe, expect, test } from 'bun:test'

import { memoryStateStore, until } from '#cloud-tests/helpers/relay'
import { openRoomLog, type RoomLog } from '#cloud/server/collaboration/relay/log'
import type { RoomState } from '#cloud/server/collaboration/relay/state'
import * as Y from 'yjs'

const room = { documentId: crypto.randomUUID(), roomEpoch: 0 }
const limits = { updates: 3, bytes: 1 << 20 }

async function openLog(store = memoryStateStore().store, logLimits = limits) {
  return { ...(await openRoomLog(store, room, logLimits)), store }
}

/** An editor's copy of the room, whose edits reach the log as the relay takes a peer's. */
function editor() {
  const document = new Y.Doc()
  const edit = (log: RoomLog, change: (text: Y.Text) => void) => {
    const before = Y.encodeStateVector(document)
    change(document.getText('t'))
    log.add(Y.encodeStateAsUpdateV2(document, before))
  }
  return {
    document,
    type: (log: RoomLog, text: string) => edit(log, (t) => t.insert(t.length, text)),
    edit
  }
}

/** The text a room's state holds. */
function textOf(state: RoomState) {
  const document = new Y.Doc()
  Y.applyUpdateV2(document, state.encode())
  return document.getText('t').toJSON()
}

describe('room log', () => {
  test('logs the updates of one save as one merged update', async () => {
    const { log, store } = await openLog()
    const { type } = editor()
    type(log, 'a')
    type(log, 'b')
    await log.save()
    const saved = await store.load(room)
    expect(saved).toMatchObject({ snapshot: null, sequence: 1 })
    expect(saved.updates).toHaveLength(1)
    // Nothing new to save writes nothing.
    await log.save()
    expect((await store.load(room)).sequence).toBe(1)
  })

  test('folds the log into a snapshot at its limit and as the room closes', async () => {
    const { log, store } = await openLog()
    const { type } = editor()
    for (const text of ['a', 'b', 'c']) {
      type(log, text)
      await log.save()
    }
    type(log, 'd')
    await log.save()
    expect(await store.load(room)).toMatchObject({ updates: [], sequence: 3 })

    type(log, 'e')
    await log.save()
    expect((await store.load(room)).updates).toHaveLength(1)
    await log.save({ closing: true })
    const closed = await store.load(room)
    expect(closed.updates).toEqual([])

    const reopened = await openRoomLog(store, room, limits)
    expect(textOf(reopened.state)).toBe('abcde')
  })

  test('logs a small change to a large room as it closes, without rewriting its snapshot', async () => {
    const { log, store } = await openLog()
    const { type } = editor()
    type(log, 'x'.repeat(10_000))
    await log.save({ closing: true })
    const { snapshot } = await store.load(room)

    const again = await openRoomLog(store, room, limits)
    type(again.log, 'small')
    await again.log.save({ closing: true })
    const saved = await store.load(room)
    expect(saved.snapshot === snapshot).toBe(true)
    expect(saved.updates).toHaveLength(1)

    const reopened = await openRoomLog(store, room, limits)
    expect(textOf(reopened.state)).toEndWith('small')
    type(reopened.log, 'y'.repeat(5_000))
    await reopened.log.save({ closing: true })
    expect((await store.load(room)).updates).toEqual([])
  })

  test('waits for a share of a large snapshot before its logged bytes fold', async () => {
    const { store } = await openLog()
    const byteLimits = { updates: 100, bytes: 100 }
    const opened = await openRoomLog(store, room, byteLimits)
    const { type } = editor()
    type(opened.log, 'x'.repeat(10_000))
    await opened.log.save({ closing: true })
    type(opened.log, 'y'.repeat(500))
    await opened.log.save()
    type(opened.log, 'z')
    await opened.log.save()
    expect((await store.load(room)).updates).toHaveLength(2)
  })

  test('keeps a refused save for the next one, which writes a snapshot', async () => {
    const memory = memoryStateStore()
    let refuse = true
    const { type } = editor()
    const { log } = await openLog({
      ...memory.store,
      async append(identity, sequence, update) {
        if (refuse) throw new Error('Database unavailable')
        await memory.store.append(identity, sequence, update)
      }
    })
    type(log, 'a')
    await expect(log.save()).rejects.toThrow('Database unavailable')
    refuse = false
    type(log, 'b')
    await log.save()
    const saved = await memory.store.load(room)
    expect(saved.updates).toEqual([])
    expect(saved.snapshot).not.toBeNull()
    expect(textOf((await openRoomLog(memory.store, room, limits)).state)).toBe('ab')
  })

  test('covers an append whose result is unknown, so the next append takes a fresh sequence', async () => {
    const memory = memoryStateStore()
    let lose = true
    const { type } = editor()
    const { log } = await openLog({
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
    type(log, 'a')
    await expect(log.save()).rejects.toThrow('Connection reset')
    type(log, 'b')
    await log.save()
    type(log, 'c')
    await log.save()
    const saved = await memory.store.load(room)
    expect(saved.sequence).toBe(2)
    expect(saved.updates).toHaveLength(1)
    expect(textOf((await openRoomLog(memory.store, room, limits)).state)).toBe('abc')
  })

  test('runs one save at a time, so two never claim one sequence', async () => {
    const memory = memoryStateStore()
    let release: (() => void) | undefined
    const sequences: number[] = []
    const { type } = editor()
    const { log } = await openLog({
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
    type(log, 'a')
    const first = log.save()
    await until(() => release !== undefined)
    // An edit after the first save took its batch, saved while that one is still writing.
    type(log, 'b')
    const second = log.save()
    await Bun.sleep(5)
    expect(sequences).toEqual([1])
    release?.()
    await Promise.all([first, second])
    expect(sequences).toEqual([1, 2])
    const reopened = await openRoomLog(memory.store, room, limits)
    expect(textOf(reopened.state)).toBe('ab')
  })

  test('takes an editor’s smaller copy as its next snapshot, keeping what the copy lacks', async () => {
    const { log, store, state } = await openLog()
    const alice = editor()
    alice.type(log, 'x'.repeat(5_000))
    alice.edit(log, (text) => text.delete(0, 5_000))
    alice.type(log, 'kept')
    // Bob's edit reached the room after Alice's copy was made.
    const bob = editor()
    bob.type(log, '!')
    const copy = Y.encodeStateAsUpdateV2(alice.document)
    const before = state.bytes
    expect(log.compactWith(copy)).toBe(true)
    expect(state.bytes).toBeLessThan(before / 10)
    expect(textOf(state)).toContain('kept')
    expect(textOf(state)).toContain('!')

    await log.save()
    const saved = await store.load(room)
    expect(saved.updates).toEqual([])
    expect(textOf((await openRoomLog(store, room, limits)).state)).toBe(textOf(state))
  })

  test('keeps its own state when an editor’s copy would not shrink it', async () => {
    const { log, state } = await openLog()
    const alice = editor()
    alice.type(log, 'abc')
    const held = state.encode()
    // A copy holding more than the room, as one with edits still on their way does.
    alice.document.getText('t').insert(3, 'def')
    expect(log.compactWith(Y.encodeStateAsUpdateV2(alice.document))).toBe(false)
    expect(state.encode()).toBe(held)
  })
})
