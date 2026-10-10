import { describe, expect, test } from 'bun:test'

import {
  connectTestClient,
  guest,
  memoryStateStore,
  relaySecret,
  relayTicket,
  until,
  user,
  type RelayTicketOptions
} from '#cloud-tests/helpers/relay'
import { COLLAB_ACTIONS, RELAY_CLOSE, RELAY_SERVER_PEER } from '#cloud/contract'
import { createCollaborationRelay, type CollaborationRelayOptions } from '#cloud/server'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as Y from 'yjs'

const documentId = crypto.randomUUID()

function relay(options: Partial<CollaborationRelayOptions> = {}) {
  const state = memoryStateStore()
  const instance = createCollaborationRelay({
    authSecret: relaySecret,
    store: state.store,
    maximumMessageBytes: 1_048_576,
    maximumConnectionsPerRoom: 100,
    persistDelayMs: 0,
    onError: () => undefined,
    ...options
  })
  return { relay: instance, ...state }
}

async function join(
  hub: ReturnType<typeof relay>['relay'],
  ticket: Partial<RelayTicketOptions> = {}
) {
  const client = connectTestClient((socket) => hub.connect(socket))
  client.send({
    type: 'auth',
    token: await relayTicket({
      documentId,
      permission: 'edit',
      principal: user(crypto.randomUUID()),
      ...ticket
    })
  })
  await until(() => client.peerId() !== undefined || client.closed !== null)
  return client
}

function edit(text: string) {
  const document = new Y.Doc()
  document.getText('t').insert(0, text)
  return Y.encodeStateAsUpdate(document)
}

function textOf(update: Uint8Array) {
  const document = new Y.Doc()
  Y.applyUpdate(document, update)
  return document.getText('t').toString()
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
