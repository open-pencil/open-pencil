import { describe, expect, setSystemTime, test } from 'bun:test'

import {
  guest,
  joinTestRelay,
  startTestRelay,
  textOfSyncReply,
  textUpdate,
  until,
  type RelayTicketOptions
} from '#cloud-tests/helpers/relay'
import { type CollaborationRelay } from '#cloud/server'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as Y from 'yjs'

import { COLLAB_ACTIONS, encodeSyncReply, RELAY_SERVER_PEER } from '@open-pencil/collab'

const documentId = crypto.randomUUID()

const join = (hub: CollaborationRelay, ticket: Partial<RelayTicketOptions> = {}) =>
  joinTestRelay(hub, documentId, ticket)

/** What an editor holding `text` answers a sync request from an empty peer with. */
function syncReply(text: string) {
  const document = new Y.Doc()
  document.getText('t').insert(0, text)
  return encodeSyncReply(document, Y.encodeStateVector(new Y.Doc()))
}

/** An editor's document, whose edits and sync replies reach the relay as a tab's do. */
function editing(client: Awaited<ReturnType<typeof join>>, document = new Y.Doc()) {
  const text = document.getText('t')
  const reply = (stateVector: Uint8Array) =>
    client.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.syncReply,
      target: RELAY_SERVER_PEER,
      payload: encodeSyncReply(document, stateVector)
    })
  return {
    document,
    text,
    /** Answers the relay's request on joining. */
    answerJoin: () =>
      reply(client.messages(COLLAB_ACTIONS.syncStep1)[0]?.payload ?? new Uint8Array([0])),
    /** Answers a request for the whole copy. */
    answerCopy: () => reply(new Uint8Array([0])),
    /** The relay's requests after the one on joining, each for the whole copy. */
    copyRequests: () => client.messages(COLLAB_ACTIONS.syncStep1).slice(1),
    /** Changes the document; the update goes out as a tab sends its edits, one per change. */
    edit(change: () => void) {
      document.once('updateV2', (update: Uint8Array) =>
        client.send({
          type: 'message',
          namespace: COLLAB_ACTIONS.yjsUpdate,
          target: null,
          payload: update
        })
      )
      document.transact(change)
    }
  }
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

  test('asks an editor that answered its join, never a viewer, for its copy once the room grows', async () => {
    const { relay: hub } = startTestRelay({ maximumRoomBytes: 8_192 })
    const viewer = await join(hub, { permission: 'view' })
    const late = await join(hub)
    const alice = await join(hub)
    // Alice answers the relay's request on joining; the other editor has not yet.
    alice.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.syncReply,
      target: RELAY_SERVER_PEER,
      payload: syncReply('')
    })
    // Filling half of what the room had left makes it ask for a compaction.
    alice.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.yjsUpdate,
      target: null,
      payload: textUpdate('x'.repeat(6_500))
    })
    const requests = (client: typeof alice) =>
      client.messages(COLLAB_ACTIONS.syncStep1).filter((frame) => frame.from === RELAY_SERVER_PEER)
    expect(requests(alice).map((frame) => [...frame.payload])).toEqual([expect.any(Array), [0]])
    expect(requests(late)).toHaveLength(1)
    expect(requests(viewer)).toEqual([])
    // The relay asked for the copy, so one it cannot read is dropped, never held against Alice.
    alice.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.syncReply,
      target: RELAY_SERVER_PEER,
      payload: new Uint8Array([1, 2, 3])
    })
    expect(alice.closed).toBeNull()
  })

  test('asks another editor once the one asked for its copy stops answering', async () => {
    const { relay: hub } = startTestRelay({ maximumRoomBytes: 8_192 })
    const editors = [await join(hub), await join(hub)]
    for (const editor of editors) {
      editor.send({
        type: 'message',
        namespace: COLLAB_ACTIONS.syncReply,
        target: RELAY_SERVER_PEER,
        payload: syncReply('')
      })
    }
    const [alice, bob] = editors
    // Each was asked once on joining; any request after that is for its copy.
    const copyRequests = (client: typeof alice) =>
      (client?.messages(COLLAB_ACTIONS.syncStep1) ?? []).slice(1)
    const fill = (text: string) =>
      alice?.send({
        type: 'message',
        namespace: COLLAB_ACTIONS.yjsUpdate,
        target: null,
        payload: textUpdate(text)
      })
    fill('x'.repeat(6_500))
    expect(copyRequests(alice)).toHaveLength(1)
    // Alice's tab never answers; until her request lapses, nobody else is asked.
    fill('y')
    expect(copyRequests(bob)).toHaveLength(0)
    try {
      setSystemTime(Date.now() + 31_000)
      fill('z')
      expect(copyRequests(bob)).toHaveLength(1)
      expect(copyRequests(alice)).toHaveLength(1)
    } finally {
      setSystemTime()
    }
  })

  test('asks for a copy only once the room deleted something, and sooner near its limit', async () => {
    const { relay: hub } = startTestRelay({ maximumRoomBytes: 64_000 })
    const alice = await join(hub)
    const { text, edit, answerJoin, answerCopy, copyRequests } = editing(alice)
    answerJoin()

    // What the room was loaded with may hold deletions, so its first growth asks once.
    edit(() => text.insert(0, 'a'.repeat(33_000)))
    expect(copyRequests()).toHaveLength(1)
    answerCopy()
    // A room that only grows has nothing for a copy to collect.
    edit(() => text.insert(0, 'b'.repeat(20_000)))
    expect(copyRequests()).toHaveLength(1)
    edit(() => text.delete(0, 10))
    expect(copyRequests()).toHaveLength(2)
    answerCopy()
    // Under 11 KB from its limit, the room asks again once it grows by half of that.
    edit(() => {
      text.insert(0, 'c'.repeat(3_000))
      text.delete(0, 10)
    })
    expect(copyRequests()).toHaveLength(2)
    edit(() => text.insert(0, 'd'.repeat(3_000)))
    expect(copyRequests()).toHaveLength(3)
    answerCopy()
    // Within the least step of its limit, a deletion may be all that still fits, so it asks.
    edit(() => text.insert(0, 'e'.repeat(4_000)))
    expect(copyRequests()).toHaveLength(3)
    edit(() => text.delete(0, 4_000))
    expect(copyRequests()).toHaveLength(4)
    expect(alice.closed).toBeNull()
  })

  test('takes an editor’s deletions on rejoining as new only when it brings new work', async () => {
    const { relay: hub } = startTestRelay({ maximumRoomBytes: 64_000 })
    const alice = await join(hub)
    const tab = editing(alice)
    tab.answerJoin()
    tab.edit(() => tab.text.insert(0, 'a'.repeat(40_000)))
    tab.answerCopy()
    tab.edit(() => {
      tab.text.delete(0, 10)
      tab.text.insert(0, 'z'.repeat(12_500))
    })
    expect(tab.copyRequests()).toHaveLength(2)
    tab.answerCopy()
    const asked = tab.copyRequests().length

    // The same document opened again replies with every deletion it holds, which the room has.
    const bob = await join(hub)
    const again = editing(bob, tab.document)
    again.answerJoin()
    // Half the room left below its limit is about 5.7 KB.
    again.edit(() => again.text.insert(0, 'b'.repeat(6_000)))
    expect(again.copyRequests()).toHaveLength(0)
    expect(tab.copyRequests()).toHaveLength(asked)
  })

  test('sends an editor the deletion a copy request counts before the request', async () => {
    const { relay: hub } = startTestRelay({ maximumRoomBytes: 64_000 })
    const alice = await join(hub)
    const bob = await join(hub)
    const [first, second] = [editing(alice), editing(bob)]
    first.answerJoin()
    second.answerJoin()
    first.edit(() => first.text.insert(0, 'a'.repeat(33_000)))
    first.answerCopy()
    // Bob's deletion makes the room ask Alice, the editor longest in it, for her copy.
    second.edit(() => {
      second.text.insert(0, 'z'.repeat(16_000))
      second.text.delete(0, 10)
    })
    expect(first.copyRequests()).toHaveLength(2)
    const request = alice.frames.findLastIndex(
      (frame) => frame.type === 'message' && frame.namespace === COLLAB_ACTIONS.syncStep1
    )
    const deletion = alice.frames.findLastIndex(
      (frame) => frame.type === 'message' && frame.namespace === COLLAB_ACTIONS.yjsUpdate
    )
    expect(deletion).toBeGreaterThan(-1)
    expect(deletion).toBeLessThan(request)
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

  const threadId = crypto.randomUUID()
  test.each([
    {
      change: 'its history',
      namespace: COLLAB_ACTIONS.versions,
      payload: new Uint8Array(),
      announce: (hub: ReturnType<typeof startTestRelay>['relay']) =>
        hub.announceVersions(documentId)
    },
    {
      change: 'a comment thread',
      namespace: COLLAB_ACTIONS.comments,
      payload: new TextEncoder().encode(threadId),
      announce: (hub: ReturnType<typeof startTestRelay>['relay']) =>
        hub.announceComments(documentId, threadId)
    }
  ])(
    'tells everyone in a document’s room, viewers too, that $change changed',
    async ({ namespace, payload, announce }) => {
      const { relay: hub } = startTestRelay()
      const alice = await join(hub)
      const bob = await join(hub, { permission: 'view' })
      const elsewhere = await join(hub, { documentId: crypto.randomUUID() })
      // A peer cannot say it; only the server can.
      alice.send({ type: 'message', namespace, target: null, payload })
      announce(hub)

      const announced = { type: 'message' as const, namespace, from: RELAY_SERVER_PEER, payload }
      await until(() => bob.messages(namespace).length > 0)
      expect(alice.messages(namespace)).toEqual([announced])
      expect(bob.messages(namespace)).toEqual([announced])
      expect(elsewhere.messages(namespace)).toEqual([])
    }
  )

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
