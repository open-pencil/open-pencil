import { describe, expect, test } from 'bun:test'

import { asDouble } from '#cloud-tests/helpers/doubles'
import {
  connectTestClient,
  memoryStateStore,
  relaySecret,
  relayTicket,
  textUpdate,
  until,
  user
} from '#cloud-tests/helpers/relay'
import { COLLAB_ACTIONS, decodeRelayServerFrame, type RelayServerFrame } from '#cloud/contract'
import { createRelaySockets } from '#cloud/runtime/cloudflare/relay/sockets'
import { createCollaborationRelay, type CollaborationStateStore } from '#cloud/server'
import { readRelayPeerState, type RelayPeerState } from '#cloud/server/collaboration/relay/resume'
import * as Y from 'yjs'

const documentId = crypto.randomUUID()
const room = { documentId, roomEpoch: 0 }

const asSocket = (socket: HibernatedSocket) => asDouble<WebSocket>(socket)

/** A hibernatable socket as the runtime hands it to a woken object. */
class HibernatedSocket {
  readyState: number = WebSocket.OPEN
  readonly frames: RelayServerFrame[] = []

  constructor(private attachment: RelayPeerState) {}

  send(data: Uint8Array) {
    const frame = decodeRelayServerFrame(data)
    if (frame) this.frames.push(frame)
  }

  close() {
    this.readyState = WebSocket.CLOSED
  }

  serializeAttachment(state: RelayPeerState) {
    this.attachment = structuredClone(state)
  }

  deserializeAttachment() {
    return this.attachment
  }
}

function relayOver(store: CollaborationStateStore) {
  return createCollaborationRelay({
    authSecret: relaySecret,
    documentId,
    store,
    maximumMessageBytes: 1_048_576,
    maximumConnectionsPerRoom: 100,
    persistDelayMs: 0,
    onError: () => undefined
  })
}

/** Editors who joined a relay that has since been set aside, with the state their sockets keep. */
async function peersOfAnEarlierWake(store: CollaborationStateStore, count: number) {
  const earlier = relayOver(store)
  const states: RelayPeerState[] = []
  for (let index = 0; index < count; index++) {
    const kept: { state: unknown } = { state: null }
    const client = connectTestClient((socket) =>
      earlier.connect({ ...socket, remember: (state) => (kept.state = state) })
    )
    client.send({
      type: 'auth',
      token: await relayTicket({
        documentId,
        permission: 'edit',
        principal: user(crypto.randomUUID())
      })
    })
    await until(() => client.peerId() !== undefined)
    client.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.yjsUpdate,
      target: null,
      payload: textUpdate(`edit ${index}`)
    })
    const state = readRelayPeerState(kept.state)
    if (!state) throw new Error('Expected a kept peer state')
    states.push(state)
  }
  return states
}

/** The sockets of an object woken from hibernation, which still holds `held`, over `store`. */
function wake(store: CollaborationStateStore, held: HibernatedSocket[]) {
  return createRelaySockets({
    sockets: () => held.filter((socket) => socket.readyState === WebSocket.OPEN).map(asSocket),
    createRelay: async () => relayOver(store)
  })
}

describe('Cloudflare relay sockets', () => {
  test('a socket that closes while the object hibernates leaves, and its room is saved', async () => {
    const memory = memoryStateStore()
    const [alice] = await peersOfAnEarlierWake(memory.store, 1)
    if (!alice) throw new Error('Expected a peer')
    await until(async () => (await memory.store.load(room)).updates.length > 0)

    // The runtime no longer lists a socket that already closed.
    const socket = new HibernatedSocket(alice)
    socket.close()
    await wake(memory.store, [socket]).closed(asSocket(socket))

    await until(async () => (await memory.store.load(room)).updates.length === 0)
    const saved = await memory.store.load(room)
    const document = new Y.Doc()
    Y.applyUpdate(document, saved.snapshot ?? new Uint8Array())
    expect(document.getText('t').toString()).toContain('edit 0')
  })

  test('the others hear a hibernated peer leave once, and the room stays open', async () => {
    const memory = memoryStateStore()
    const [alice, bob] = await peersOfAnEarlierWake(memory.store, 2)
    if (!alice || !bob) throw new Error('Expected two peers')
    await until(async () => (await memory.store.load(room)).updates.length >= 2)

    // Still listed while its close is delivered, so the woken relay takes it back first.
    const aliceSocket = new HibernatedSocket(alice)
    const bobSocket = new HibernatedSocket(bob)
    await wake(memory.store, [aliceSocket, bobSocket]).closed(asSocket(aliceSocket))

    expect(bobSocket.frames).toEqual([{ type: 'leave', peerId: alice.peerId }])
    expect((await memory.store.load(room)).snapshot).toBeNull()
  })
})
