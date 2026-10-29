import { describe, expect, test } from 'bun:test'

import {
  connectTestClient,
  guest,
  joinTestRelay,
  memoryStateStore,
  relaySecret,
  relayTicket,
  startTestRelay,
  textOfSyncReply,
  textUpdate,
  until,
  user,
  type RelayTicketOptions
} from '#cloud-tests/helpers/relay'
import { COLLAB_ACTIONS, encodeSyncReply, RELAY_CLOSE, RELAY_SERVER_PEER } from '#cloud/contract'
import { createCollaborationRelay, type CollaborationRelay } from '#cloud/server'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as Y from 'yjs'

const documentId = crypto.randomUUID()

const relay = startTestRelay
const join = (hub: CollaborationRelay, ticket: Partial<RelayTicketOptions> = {}) =>
  joinTestRelay(hub, documentId, ticket)
const edit = textUpdate
const textOf = textOfSyncReply

/** What an editor holding `text` answers a sync request from an empty peer with. */
function syncReply(text: string) {
  const document = new Y.Doc()
  document.getText('t').insert(0, text)
  return encodeSyncReply(document, Y.encodeStateVector(new Y.Doc()))
}

describe('collaboration relay', () => {
  test('welcomes peers with everyone in the room and announces arrivals and departures', async () => {
    const { relay: hub } = relay()
    const alice = await join(hub)
    const bob = await join(hub)
    const [aliceId, bobId] = [alice.peerId() ?? '', bob.peerId() ?? '']

    expect(alice.frames[0]).toEqual({
      type: 'welcome',
      peerId: aliceId,
      peers: [RELAY_SERVER_PEER]
    })
    expect(bob.frames[0]).toEqual({
      type: 'welcome',
      peerId: bobId,
      peers: [RELAY_SERVER_PEER, aliceId]
    })
    expect(alice.frames).toContainEqual({ type: 'join', peerId: bobId })

    bob.connection.closed()
    expect(alice.frames).toContainEqual({ type: 'leave', peerId: bobId })
  })

  test('keeps the document from editors and serves it to newcomers', async () => {
    const { relay: hub } = relay()
    const alice = await join(hub)
    alice.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.yjsUpdate,
      target: null,
      payload: edit('hello')
    })

    const bob = await join(hub, { permission: 'view' })
    bob.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.syncStep1,
      target: RELAY_SERVER_PEER,
      payload: Y.encodeStateVector(new Y.Doc())
    })
    const [reply] = bob.messages(COLLAB_ACTIONS.syncReply)
    expect(reply?.from).toBe(RELAY_SERVER_PEER)
    expect(textOf(reply?.payload ?? new Uint8Array())).toBe('hello')
  })

  test('asks editors, not viewers, for what they have that the room lacks', async () => {
    const { relay: hub } = relay()
    const editor = await join(hub)
    const viewer = await join(hub, { permission: 'view' })
    expect(editor.messages(COLLAB_ACTIONS.syncStep1).map((frame) => frame.from)).toEqual([
      RELAY_SERVER_PEER
    ])
    expect(viewer.messages(COLLAB_ACTIONS.syncStep1)).toEqual([])
  })

  test('takes an editor’s compressed answer into the room', async () => {
    const { relay: hub } = relay()
    const editor = await join(hub)
    editor.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.syncReply,
      target: RELAY_SERVER_PEER,
      payload: syncReply('offline')
    })
    expect(editor.closed).toBeNull()

    const bob = await join(hub)
    bob.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.syncStep1,
      target: RELAY_SERVER_PEER,
      payload: Y.encodeStateVector(new Y.Doc())
    })
    expect(textOf(bob.messages(COLLAB_ACTIONS.syncReply)[0]?.payload ?? new Uint8Array())).toBe(
      'offline'
    )
  })

  test('forwards editor messages to everyone or to the named peer', async () => {
    const { relay: hub } = relay()
    const alice = await join(hub)
    const bob = await join(hub)
    const carol = await join(hub)
    const update = edit('x')
    alice.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.yjsUpdate,
      target: null,
      payload: update
    })
    alice.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.agentPreview,
      target: carol.peerId() ?? null,
      payload: new Uint8Array([1])
    })

    for (const peer of [bob, carol]) {
      expect(peer.messages(COLLAB_ACTIONS.yjsUpdate)).toEqual([
        {
          type: 'message',
          namespace: COLLAB_ACTIONS.yjsUpdate,
          from: alice.peerId() ?? '',
          payload: update
        }
      ])
    }
    expect(alice.messages(COLLAB_ACTIONS.yjsUpdate)).toEqual([])
    expect(bob.messages(COLLAB_ACTIONS.agentPreview)).toEqual([])
    expect(carol.messages(COLLAB_ACTIONS.agentPreview)).toHaveLength(1)
  })

  test('tells everyone in a document’s room, viewers too, that its history changed', async () => {
    const { relay: hub } = relay()
    const alice = await join(hub)
    const bob = await join(hub, { permission: 'view' })
    const elsewhere = await join(hub, { documentId: crypto.randomUUID() })
    // A peer cannot say it; only the server can.
    alice.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.versions,
      target: null,
      payload: new Uint8Array()
    })
    hub.announceVersions(documentId)

    const announced = {
      type: 'message' as const,
      namespace: COLLAB_ACTIONS.versions,
      from: RELAY_SERVER_PEER,
      payload: new Uint8Array()
    }
    await until(() => bob.messages(COLLAB_ACTIONS.versions).length > 0)
    expect(alice.messages(COLLAB_ACTIONS.versions)).toEqual([announced])
    expect(bob.messages(COLLAB_ACTIONS.versions)).toEqual([announced])
    expect(elsewhere.messages(COLLAB_ACTIONS.versions)).toEqual([])
  })

  test('drops document writes from viewers', async () => {
    const { relay: hub } = relay()
    const editor = await join(hub)
    const viewer = await join(hub, { permission: 'view' })
    for (const namespace of [
      COLLAB_ACTIONS.yjsUpdate,
      COLLAB_ACTIONS.syncReply,
      COLLAB_ACTIONS.agentPreview
    ]) {
      viewer.send({ type: 'message', namespace, target: null, payload: edit('vandal') })
    }
    viewer.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.syncReply,
      target: RELAY_SERVER_PEER,
      payload: edit('vandal')
    })

    expect(
      editor.frames.filter((frame) => frame.type === 'message' && frame.from === viewer.peerId())
    ).toEqual([])
    const newcomer = await join(hub, { permission: 'view' })
    newcomer.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.syncStep1,
      target: RELAY_SERVER_PEER,
      payload: Y.encodeStateVector(new Y.Doc())
    })
    expect(
      textOf(newcomer.messages(COLLAB_ACTIONS.syncReply)[0]?.payload ?? new Uint8Array())
    ).toBe('')
  })

  test('forwards viewer presence under the identity on their ticket', async () => {
    const { relay: hub } = relay()
    const editor = await join(hub)
    const viewer = await join(hub, { permission: 'view', principal: guest('g1', 'Grace') })
    const awareness = new awarenessProtocol.Awareness(new Y.Doc())
    awareness.setLocalState({ user: { name: 'Admin' } })
    viewer.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.awareness,
      target: null,
      payload: awarenessProtocol.encodeAwarenessUpdate(awareness, [awareness.clientID])
    })

    const [forwarded] = editor.messages(COLLAB_ACTIONS.awareness)
    const seen = new awarenessProtocol.Awareness(new Y.Doc())
    awarenessProtocol.applyAwarenessUpdate(seen, forwarded?.payload ?? new Uint8Array(), 'remote')
    expect(seen.getStates().get(awareness.clientID)).toMatchObject({
      user: { name: 'Grace' },
      cloud: { kind: 'guest', id: 'g1', permission: 'view' }
    })
  })

  test('saves the room when its last peer leaves and loads it when the room reopens', async () => {
    const first = relay()
    const alice = await join(first.relay)
    alice.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.yjsUpdate,
      target: null,
      payload: edit('kept')
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
    expect(textOf(bob.messages(COLLAB_ACTIONS.syncReply)[0]?.payload ?? new Uint8Array())).toBe(
      'kept'
    )
    await second.close()
  })

  test('ends a restored document’s room without saving the replaced state', async () => {
    const { relay: hub, states } = relay({ persistDelayMs: 60_000 })
    const alice = await join(hub)
    alice.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.yjsUpdate,
      target: null,
      payload: edit('replaced')
    })

    hub.startOver(documentId)
    expect(alice.closed?.code).toBe(RELAY_CLOSE.restored)
    expect(states.size).toBe(0)
  })

  test('turns away a ticket for a room the document has moved on from', async () => {
    const { relay: hub } = relay({ currentRoomEpoch: async () => 1 })
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
    const { relay: hub } = relay({
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

  test('admits a newcomer to the live room when the last peer leaves while it is checked', async () => {
    let releaseLimit: (() => void) | undefined
    let checks = 0
    const hub = relay({
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
      payload: edit('kept')
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
    expect(textOf(bob.messages(COLLAB_ACTIONS.syncReply)[0]?.payload ?? new Uint8Array())).toBe(
      'kept'
    )
  })

  test('keeps a room whose save failed and hands it to the next peer', async () => {
    const state = memoryStateStore()
    let refuse = true
    const hub = createCollaborationRelay({
      authSecret: relaySecret,
      store: {
        load: state.store.load,
        async store(room, update) {
          if (refuse) throw new Error('Database unavailable')
          await state.store.store(room, update)
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
      payload: edit('unsaved')
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
    expect(textOf(bob.messages(COLLAB_ACTIONS.syncReply)[0]?.payload ?? new Uint8Array())).toBe(
      'unsaved'
    )

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
        async store() {
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
      payload: edit('unsaved')
    })
    await hub.close()
    const afterClose = attempts
    await Bun.sleep(30)
    expect(attempts).toBe(afterClose)
  })

  test('closes a socket that sends too much before it joins the room', async () => {
    let releaseLimit: (() => void) | undefined
    const { relay: hub } = relay({
      maximumMessageBytes: 4096,
      async maximumParticipants() {
        await new Promise<void>((resolve) => {
          releaseLimit = resolve
        })
        return 10
      }
    })
    const client = connectTestClient((socket) => hub.connect(socket))
    client.send({
      type: 'auth',
      token: await relayTicket({ documentId, permission: 'edit', principal: user('flooder') })
    })
    await until(() => releaseLimit !== undefined)
    for (let index = 0; index < 4; index++) {
      client.send({
        type: 'message',
        namespace: COLLAB_ACTIONS.yjsUpdate,
        target: null,
        payload: new Uint8Array(2048)
      })
    }
    expect(client.closed?.code).toBe(RELAY_CLOSE.messageTooLarge)
    releaseLimit?.()
  })

  test('refuses sockets without a valid ticket for the room', async () => {
    const { relay: hub } = relay({ authTimeoutMs: 5 })
    const silent = connectTestClient((socket) => hub.connect(socket))
    await until(() => silent.closed !== null)
    expect(silent.closed?.code).toBe(RELAY_CLOSE.unauthorized)

    const forged = connectTestClient((socket) => hub.connect(socket))
    forged.send({ type: 'auth', token: 'not-a-ticket' })
    await until(() => forged.closed !== null)
    expect(forged.closed?.code).toBe(RELAY_CLOSE.unauthorized)

    const elsewhere = await join(hub, { roomId: `cloud:${crypto.randomUUID()}:0` })
    expect(elsewhere.closed?.code).toBe(RELAY_CLOSE.unauthorized)

    const early = connectTestClient((socket) => hub.connect(socket))
    early.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.yjsUpdate,
      target: null,
      payload: edit('x')
    })
    expect(early.closed?.code).toBe(RELAY_CLOSE.unauthorized)
  })

  test('a relay for one document refuses tickets for another', async () => {
    const { relay: hub } = relay({ documentId })
    const stranger = await joinTestRelay(hub, crypto.randomUUID())
    expect(stranger.closed?.code).toBe(RELAY_CLOSE.unauthorized)
    expect((await join(hub)).closed).toBeNull()
  })

  test('keeps a peer that refreshes its ticket and closes one that changes identity', async () => {
    const { relay: hub } = relay()
    const principal = user('alice')
    const alice = await join(hub, { principal })
    alice.send({
      type: 'auth',
      token: await relayTicket({ documentId, permission: 'view', principal })
    })
    await until(() => alice.closed === null)
    alice.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.yjsUpdate,
      target: null,
      payload: edit('x')
    })
    const bob = await join(hub)
    expect(bob.messages(COLLAB_ACTIONS.yjsUpdate)).toEqual([])

    alice.send({
      type: 'auth',
      token: await relayTicket({ documentId, permission: 'edit', principal: user('mallory') })
    })
    await until(() => alice.closed !== null)
    expect(alice.closed?.code).toBe(RELAY_CLOSE.unauthorized)
  })

  test('enforces room capacity, participant limits, and message size', async () => {
    const full = relay({ maximumConnectionsPerRoom: 1 })
    await join(full.relay)
    expect((await join(full.relay)).closed?.code).toBe(RELAY_CLOSE.roomFull)

    const limited = relay({ maximumParticipants: async () => 1 })
    await join(limited.relay)
    expect((await join(limited.relay)).closed?.code).toBe(RELAY_CLOSE.roomFull)

    const small = relay({ maximumMessageBytes: 4_096 })
    const alice = await join(small.relay)
    alice.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.yjsUpdate,
      target: null,
      payload: new Uint8Array(8_192)
    })
    expect(alice.closed?.code).toBe(RELAY_CLOSE.messageTooLarge)
  })

  test('closes peers that send malformed document updates', async () => {
    const { relay: hub } = relay()
    const alice = await join(hub)
    alice.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.yjsUpdate,
      target: null,
      payload: new Uint8Array([255, 255, 255])
    })
    expect(alice.closed?.code).toBe(RELAY_CLOSE.protocol)
  })
})
