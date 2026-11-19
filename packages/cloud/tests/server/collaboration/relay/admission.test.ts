import { describe, expect, test } from 'bun:test'

import {
  connectTestClient,
  joinTestRelay,
  relayTicket,
  startTestRelay,
  textOfSyncReply,
  textUpdate,
  until,
  user,
  type RelayTicketOptions
} from '#cloud-tests/helpers/relay'
import { COLLAB_ACTIONS, RELAY_CLOSE, RELAY_SERVER_PEER } from '#cloud/contract'
import { type CollaborationRelay } from '#cloud/server'
import * as Y from 'yjs'

const documentId = crypto.randomUUID()

const join = (hub: CollaborationRelay, ticket: Partial<RelayTicketOptions> = {}) =>
  joinTestRelay(hub, documentId, ticket)
describe('collaboration relay admission', () => {
  test('closes a socket that sends too much before it joins the room', async () => {
    let releaseLimit: (() => void) | undefined
    const { relay: hub } = startTestRelay({
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
    const { relay: hub } = startTestRelay({ authTimeoutMs: 5 })
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
      payload: textUpdate('x')
    })
    expect(early.closed?.code).toBe(RELAY_CLOSE.unauthorized)
  })

  test('a relay for one document refuses tickets for another', async () => {
    const { relay: hub } = startTestRelay({ documentId })
    const stranger = await joinTestRelay(hub, crypto.randomUUID())
    expect(stranger.closed?.code).toBe(RELAY_CLOSE.unauthorized)
    expect((await join(hub)).closed).toBeNull()
  })

  test('keeps a peer that refreshes its ticket and closes one that changes identity', async () => {
    const { relay: hub } = startTestRelay()
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
      payload: textUpdate('x')
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
    const full = startTestRelay({ maximumConnectionsPerRoom: 1 })
    await join(full.relay)
    expect((await join(full.relay)).closed?.code).toBe(RELAY_CLOSE.roomFull)

    const limited = startTestRelay({ maximumParticipants: async () => 1 })
    await join(limited.relay)
    expect((await join(limited.relay)).closed?.code).toBe(RELAY_CLOSE.roomFull)

    const small = startTestRelay({ maximumMessageBytes: 4_096 })
    const alice = await join(small.relay)
    alice.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.yjsUpdate,
      target: null,
      payload: new Uint8Array(8_192)
    })
    expect(alice.closed?.code).toBe(RELAY_CLOSE.messageTooLarge)
  })

  test('turns away an editor whose update would grow the room past its limit', async () => {
    const { relay: hub } = startTestRelay({ maximumRoomBytes: 4_096 })
    const alice = await join(hub)
    const send = () =>
      alice.send({
        type: 'message',
        namespace: COLLAB_ACTIONS.yjsUpdate,
        target: null,
        payload: textUpdate('x'.repeat(1_000))
      })
    for (let index = 0; index < 4; index++) send()
    expect(alice.closed).toBeNull()
    send()
    expect(alice.closed?.code).toBe(RELAY_CLOSE.messageTooLarge)

    const bob = await join(hub, { permission: 'view' })
    bob.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.syncStep1,
      target: RELAY_SERVER_PEER,
      payload: Y.encodeStateVector(new Y.Doc())
    })
    const [reply] = bob.messages(COLLAB_ACTIONS.syncReply)
    expect(textOfSyncReply(reply?.payload ?? new Uint8Array())).toHaveLength(4_000)
  })

  test('lets a full room shrink, and takes edits again once it has', async () => {
    const editor = new Y.Doc()
    const text = editor.getText('t')
    const change = (edit: () => void) => {
      const before = Y.encodeStateVector(editor)
      edit()
      return Y.encodeStateAsUpdateV2(editor, before)
    }
    const inserts = [1, 2, 3].map(() => change(() => text.insert(0, 'x'.repeat(1_200))))
    const deletion = change(() => text.delete(0, text.length))
    // The inserts fill the room exactly, so the deletion takes it past its bound.
    const full = inserts.reduce((total, update) => total + update.byteLength, 0)
    const { relay: hub } = startTestRelay({ maximumRoomBytes: full })
    const alice = await join(hub)
    const send = (payload: Uint8Array) =>
      alice.send({ type: 'message', namespace: COLLAB_ACTIONS.yjsUpdate, target: null, payload })
    for (const insert of inserts) send(insert)
    // Deleting adds nothing, so it goes through however full the room is.
    send(deletion)
    expect(alice.closed).toBeNull()
    // The deletion freed the room, which a measure finds before turning the edit away.
    send(change(() => text.insert(0, 'y'.repeat(1_200))))
    expect(alice.closed).toBeNull()
  })

  test('counts deletions of what the room never received against its limit', async () => {
    const { relay: hub } = startTestRelay({ maximumRoomBytes: 512 })
    const alice = await join(hub)
    // A document the room never saw: deleting from it leaves deletions the room must keep.
    const ghost = new Y.Doc()
    const text = ghost.getText('t')
    text.insert(0, 'x'.repeat(1_000))
    for (let sent = 0; sent < 500 && alice.closed === null; sent++) {
      text.delete(sent % 2 === 0 ? 0 : text.length - 1, 1)
      // Everything the ghost deleted, and none of its content.
      const deletions = Y.diffUpdateV2(Y.encodeStateAsUpdateV2(ghost), Y.encodeStateVector(ghost))
      alice.send({
        type: 'message',
        namespace: COLLAB_ACTIONS.yjsUpdate,
        target: null,
        payload: deletions
      })
    }
    expect(alice.closed?.code).toBe(RELAY_CLOSE.messageTooLarge)
  })

  test('closes peers that send malformed document updates', async () => {
    const { relay: hub } = startTestRelay()
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
