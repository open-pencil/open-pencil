import { describe, expect, test } from 'bun:test'

import {
  joinTestRelay,
  memoryStateStore,
  relaySecret,
  startTestRelay,
  textOfSyncReply,
  textUpdate,
  until,
  type RelayTicketOptions
} from '#cloud-tests/helpers/relay'
import { COLLAB_ACTIONS, RELAY_CLOSE, RELAY_SERVER_PEER } from '#cloud/contract'
import { createCollaborationRelay, type CollaborationRelay } from '#cloud/server'
import * as Y from 'yjs'

const documentId = crypto.randomUUID()

const join = (hub: CollaborationRelay, ticket: Partial<RelayTicketOptions> = {}) =>
  joinTestRelay(hub, documentId, ticket)
describe('collaboration relay rooms', () => {
  test('saves the room when its last peer leaves and loads it when the room reopens', async () => {
    const first = startTestRelay()
    const alice = await join(first.relay)
    alice.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.yjsUpdate,
      target: null,
      payload: textUpdate('kept')
    })
    alice.connection.closed()
    await until(() => first.states.size > 0)

    const second = createCollaborationRelay({
      authSecret: relaySecret,
      store: first.store,
      maximumMessageBytes: 1_048_576,
      maximumConnectionsPerRoom: 100
    })
    const bob = await join(second, { permission: 'view' })
    bob.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.syncStep1,
      target: RELAY_SERVER_PEER,
      payload: Y.encodeStateVector(new Y.Doc())
    })
    expect(
      textOfSyncReply(bob.messages(COLLAB_ACTIONS.syncReply)[0]?.payload ?? new Uint8Array())
    ).toBe('kept')
    await second.close()
  })

  test('ends a restored document’s room without saving the replaced state', async () => {
    const { relay: hub, states } = startTestRelay({ persistDelayMs: 60_000 })
    const alice = await join(hub)
    alice.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.yjsUpdate,
      target: null,
      payload: textUpdate('replaced')
    })

    hub.startOver(documentId)
    expect(alice.closed?.code).toBe(RELAY_CLOSE.restored)
    expect(states.size).toBe(0)
  })

  test('turns away a ticket for a room the document has moved on from', async () => {
    const { relay: hub } = startTestRelay({ currentRoomEpoch: async () => 1 })
    const stale = await join(hub, { roomEpoch: 0 })
    expect(stale.closed?.code).toBe(RELAY_CLOSE.restored)

    const current = await join(hub, { roomEpoch: 1 })
    expect(current.closed).toBeNull()
    expect(current.peerId()).toBeDefined()
  })

  test('turns away a peer whose room was still opening when the document was restored', async () => {
    const state = memoryStateStore()
    let epoch = 0
    let releaseLoad: (() => void) | undefined
    const { relay: hub } = startTestRelay({
      store: {
        ...state.store,
        async load(identity) {
          await new Promise<void>((resolve) => {
            releaseLoad = resolve
          })
          return state.store.load(identity)
        }
      },
      currentRoomEpoch: async () => epoch
    })
    const joining = join(hub, { roomEpoch: 0 })
    await until(() => releaseLoad !== undefined)
    epoch = 1
    hub.startOver(documentId)
    releaseLoad?.()

    expect((await joining).closed?.code).toBe(RELAY_CLOSE.restored)
  })

  test('turns away a peer whose room was still opening when the document was taken down', async () => {
    const state = memoryStateStore()
    let takenDown = false
    let releaseLoad: (() => void) | undefined
    const { relay: hub } = startTestRelay({
      store: {
        ...state.store,
        async load(identity) {
          if (!releaseLoad) {
            await new Promise<void>((resolve) => {
              releaseLoad = resolve
            })
          }
          return state.store.load(identity)
        }
      },
      maximumParticipants: async () => (takenDown ? 0 : null)
    })
    const joining = join(hub)
    await until(() => releaseLoad !== undefined)
    takenDown = true
    hub.closeDocument(documentId)
    releaseLoad?.()

    expect((await joining).closed?.code).toBe(RELAY_CLOSE.roomFull)
  })

  test('admits a newcomer to the live room when the last peer leaves while it is checked', async () => {
    let releaseLimit: (() => void) | undefined
    let checks = 0
    const hub = startTestRelay({
      async maximumParticipants() {
        checks++
        if (checks === 2) {
          await new Promise<void>((resolve) => {
            releaseLimit = resolve
          })
        }
        return 10
      }
    })
    const alice = await join(hub.relay)
    alice.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.yjsUpdate,
      target: null,
      payload: textUpdate('kept')
    })
    const bobJoining = join(hub.relay, { permission: 'view' })
    await until(() => releaseLimit !== undefined)
    alice.connection.closed()
    await until(() => hub.states.size > 0)
    releaseLimit?.()

    const bob = await bobJoining
    bob.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.syncStep1,
      target: RELAY_SERVER_PEER,
      payload: Y.encodeStateVector(new Y.Doc())
    })
    await until(() => bob.messages(COLLAB_ACTIONS.syncReply).length > 0 || bob.closed !== null)
    expect(bob.closed).toBeNull()
    expect(
      textOfSyncReply(bob.messages(COLLAB_ACTIONS.syncReply)[0]?.payload ?? new Uint8Array())
    ).toBe('kept')
  })

  test('keeps a room whose save failed and hands it to the next peer', async () => {
    const state = memoryStateStore()
    let refuse = true
    const hub = createCollaborationRelay({
      authSecret: relaySecret,
      store: {
        load: state.store.load,
        async append(room, sequence, update) {
          if (refuse) throw new Error('Database unavailable')
          await state.store.append(room, sequence, update)
        },
        async compact(room, sequence, update) {
          if (refuse) throw new Error('Database unavailable')
          await state.store.compact(room, sequence, update)
        }
      },
      maximumMessageBytes: 1_048_576,
      maximumConnectionsPerRoom: 100,
      persistDelayMs: 0,
      persistRetryMs: 10,
      onError: () => undefined
    })
    const alice = await join(hub)
    alice.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.yjsUpdate,
      target: null,
      payload: textUpdate('unsaved')
    })
    alice.connection.closed()

    const bob = await join(hub, { permission: 'view' })
    bob.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.syncStep1,
      target: RELAY_SERVER_PEER,
      payload: Y.encodeStateVector(new Y.Doc())
    })
    await until(() => bob.messages(COLLAB_ACTIONS.syncReply).length > 0)
    expect(
      textOfSyncReply(bob.messages(COLLAB_ACTIONS.syncReply)[0]?.payload ?? new Uint8Array())
    ).toBe('unsaved')

    // Once the store accepts it again, the retry saves what the room held.
    refuse = false
    bob.connection.closed()
    await until(() => state.states.size > 0)
    await hub.close()
  })

  test('stops retrying a failed save once the relay closes', async () => {
    let attempts = 0
    const hub = createCollaborationRelay({
      authSecret: relaySecret,
      store: {
        load: memoryStateStore().store.load,
        async append() {
          attempts++
          throw new Error('Database unavailable')
        },
        async compact() {
          attempts++
          throw new Error('Database unavailable')
        }
      },
      maximumMessageBytes: 1_048_576,
      maximumConnectionsPerRoom: 100,
      persistDelayMs: 60_000,
      persistRetryMs: 5,
      onError: () => undefined
    })
    const alice = await join(hub)
    alice.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.yjsUpdate,
      target: null,
      payload: textUpdate('unsaved')
    })
    await hub.close()
    const afterClose = attempts
    await Bun.sleep(30)
    expect(attempts).toBe(afterClose)
  })

  test('closes a taken-down document’s rooms, keeping their edits for a restore', async () => {
    const { relay: hub, store } = startTestRelay()
    const alice = await join(hub)
    alice.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.yjsUpdate,
      target: null,
      payload: textUpdate('kept')
    })
    hub.closeDocument(documentId)
    expect(alice.closed?.code).toBe(RELAY_CLOSE.unauthorized)

    // The room was saved, so once restored it opens with the edit.
    await until(async () => (await store.load({ documentId, roomEpoch: 0 })).snapshot !== null)
    const bob = await join(hub, { permission: 'view' })
    bob.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.syncStep1,
      target: RELAY_SERVER_PEER,
      payload: Y.encodeStateVector(new Y.Doc())
    })
    await until(() => bob.messages(COLLAB_ACTIONS.syncReply).length > 0)
    expect(
      textOfSyncReply(bob.messages(COLLAB_ACTIONS.syncReply)[0]?.payload ?? new Uint8Array())
    ).toBe('kept')
  })
})
