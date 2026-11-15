import { describe, expect, test } from 'bun:test'

import {
  guest,
  joinTestRelay,
  startTestRelay,
  textOfSyncReply,
  textUpdate,
  until,
  type RelayTicketOptions
} from '#cloud-tests/helpers/relay'
import { COLLAB_ACTIONS, encodeSyncReply, RELAY_SERVER_PEER } from '#cloud/contract'
import { type CollaborationRelay } from '#cloud/server'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as Y from 'yjs'

const documentId = crypto.randomUUID()

const join = (hub: CollaborationRelay, ticket: Partial<RelayTicketOptions> = {}) =>
  joinTestRelay(hub, documentId, ticket)

/** What an editor holding `text` answers a sync request from an empty peer with. */
function syncReply(text: string) {
  const document = new Y.Doc()
  document.getText('t').insert(0, text)
  return encodeSyncReply(document, Y.encodeStateVector(new Y.Doc()))
}
describe('collaboration relay', () => {
  test('welcomes peers with everyone in the room and announces arrivals and departures', async () => {
    const { relay: hub } = startTestRelay()
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
    const { relay: hub } = startTestRelay()
    const alice = await join(hub)
    alice.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.yjsUpdate,
      target: null,
      payload: textUpdate('hello')
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
    expect(textOfSyncReply(reply?.payload ?? new Uint8Array())).toBe('hello')
  })

  test('asks editors, not viewers, for what they have that the room lacks', async () => {
    const { relay: hub } = startTestRelay()
    const editor = await join(hub)
    const viewer = await join(hub, { permission: 'view' })
    expect(editor.messages(COLLAB_ACTIONS.syncStep1).map((frame) => frame.from)).toEqual([
      RELAY_SERVER_PEER
    ])
    expect(viewer.messages(COLLAB_ACTIONS.syncStep1)).toEqual([])
  })

  test('takes an editor’s compressed answer into the room', async () => {
    const { relay: hub } = startTestRelay()
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
    expect(
      textOfSyncReply(bob.messages(COLLAB_ACTIONS.syncReply)[0]?.payload ?? new Uint8Array())
    ).toBe('offline')
  })

  test('forwards editor messages to everyone or to the named peer', async () => {
    const { relay: hub } = startTestRelay()
    const alice = await join(hub)
    const bob = await join(hub)
    const carol = await join(hub)
    const update = textUpdate('x')
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
    const { relay: hub } = startTestRelay()
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
    const { relay: hub } = startTestRelay()
    const editor = await join(hub)
    const viewer = await join(hub, { permission: 'view' })
    for (const namespace of [
      COLLAB_ACTIONS.yjsUpdate,
      COLLAB_ACTIONS.syncReply,
      COLLAB_ACTIONS.agentPreview
    ]) {
      viewer.send({ type: 'message', namespace, target: null, payload: textUpdate('vandal') })
    }
    viewer.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.syncReply,
      target: RELAY_SERVER_PEER,
      payload: textUpdate('vandal')
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
      textOfSyncReply(newcomer.messages(COLLAB_ACTIONS.syncReply)[0]?.payload ?? new Uint8Array())
    ).toBe('')
  })

  test('forwards viewer presence under the identity on their ticket', async () => {
    const { relay: hub } = startTestRelay()
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
})
