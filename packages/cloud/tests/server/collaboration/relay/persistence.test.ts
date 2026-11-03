import { describe, expect, test } from 'bun:test'

import {
  joinTestRelay,
  memoryStateStore,
  relaySecret,
  startTestRelay,
  textOfSyncReply,
  textUpdate,
  until
} from '#cloud-tests/helpers/relay'
import { COLLAB_ACTIONS, RELAY_SERVER_PEER } from '#cloud/contract'
import { createCollaborationRelay, type CollaborationRelay } from '#cloud/server'
import * as Y from 'yjs'

const documentId = crypto.randomUUID()
const room = { documentId, roomEpoch: 0 }

async function type(hub: CollaborationRelay, text: string) {
  const peer = await joinTestRelay(hub, documentId)
  peer.send({
    type: 'message',
    namespace: COLLAB_ACTIONS.yjsUpdate,
    target: null,
    payload: textUpdate(text)
  })
  return peer
}

/** The room's text as a newcomer to `hub` receives it. */
async function textIn(hub: CollaborationRelay) {
  const viewer = await joinTestRelay(hub, documentId, { permission: 'view' })
  viewer.send({
    type: 'message',
    namespace: COLLAB_ACTIONS.syncStep1,
    target: RELAY_SERVER_PEER,
    payload: Y.encodeStateVector(new Y.Doc())
  })
  await until(() => viewer.messages(COLLAB_ACTIONS.syncReply).length > 0)
  return textOfSyncReply(viewer.messages(COLLAB_ACTIONS.syncReply)[0]?.payload ?? new Uint8Array())
}

describe('collaboration room saves', () => {
  test('logs each save as an update while the room is open, and leaves a snapshot as it closes', async () => {
    const { relay, store } = startTestRelay()
    const alice = await type(relay, 'a')
    await until(async () => (await store.load(room)).updates.length === 1)
    await type(relay, 'b')
    await until(async () => (await store.load(room)).updates.length === 2)
    const open = await store.load(room)
    expect(open.snapshot).toBeNull()
    // A logged save carries the edit, not the whole room.
    for (const update of open.updates) expect(update.byteLength).toBeLessThan(100)

    alice.connection.closed()
    await relay.close()
    const closed = await store.load(room)
    expect(closed.snapshot).not.toBeNull()
    expect(closed.updates).toEqual([])
  })

  test('folds the log into a snapshot once it reaches its limit', async () => {
    const { relay, store } = startTestRelay({ compactAfterUpdates: 2 })
    for (const text of ['a', 'b', 'c']) {
      await type(relay, text)
      await until(async () => {
        const saved = await store.load(room)
        return saved.updates.length + (saved.snapshot ? 1 : 0) > 0
      })
    }
    await until(async () => (await store.load(room)).snapshot !== null)
    const saved = await store.load(room)
    expect(saved.updates.length).toBeLessThan(2)
    await relay.close()
  })

  test('reopens a room from its snapshot and the updates logged after it', async () => {
    const first = startTestRelay({ compactAfterUpdates: 1 })
    await type(first.relay, 'a')
    await until(async () => (await first.store.load(room)).updates.length === 1)
    await type(first.relay, 'b')
    await until(async () => (await first.store.load(room)).snapshot !== null)
    await type(first.relay, 'c')
    await until(async () => (await first.store.load(room)).updates.length === 1)

    // The first relay stops without closing the room, as a crash would.
    const second = createCollaborationRelay({
      authSecret: relaySecret,
      store: first.store,
      maximumMessageBytes: 1_048_576,
      maximumConnectionsPerRoom: 100
    })
    expect([...(await textIn(second))].toSorted()).toEqual(['a', 'b', 'c'])
    await second.close()
  })

  test('writes a snapshot after a save whose result is unknown, never the same sequence twice', async () => {
    const memory = memoryStateStore()
    let failNextAppend = true
    const sequences: number[] = []
    const hub = createCollaborationRelay({
      authSecret: relaySecret,
      store: {
        load: memory.store.load,
        // The update lands, but the answer is lost.
        async append(identity, sequence, update) {
          sequences.push(sequence)
          await memory.store.append(identity, sequence, update)
          if (failNextAppend) {
            failNextAppend = false
            throw new Error('Connection reset')
          }
        },
        compact: memory.store.compact
      },
      maximumMessageBytes: 1_048_576,
      maximumConnectionsPerRoom: 100,
      persistDelayMs: 0,
      persistRetryMs: 10,
      onError: () => undefined
    })
    await type(hub, 'a')
    await until(() => sequences.length === 1)
    await type(hub, 'b')
    await until(async () => (await memory.store.load(room)).snapshot !== null)
    expect(sequences).toEqual([1])
    expect(await textIn(hub)).toHaveLength(2)
    await hub.close()
  })

  test('saves again after a failed save while the room stays open, without another edit', async () => {
    const memory = memoryStateStore()
    let refuse = true
    const hub = createCollaborationRelay({
      authSecret: relaySecret,
      store: {
        ...memory.store,
        async append(identity, sequence, update) {
          if (refuse) {
            refuse = false
            throw new Error('Database unavailable')
          }
          await memory.store.append(identity, sequence, update)
        }
      },
      maximumMessageBytes: 1_048_576,
      maximumConnectionsPerRoom: 100,
      persistDelayMs: 0,
      persistRetryMs: 10,
      onError: () => undefined
    })
    await type(hub, 'a')
    // The retry writes a snapshot, since whether the refused append landed is unknown.
    await until(async () => (await memory.store.load(room)).snapshot !== null)
    expect(await textIn(hub)).toBe('a')
    await hub.close()
  })
})
