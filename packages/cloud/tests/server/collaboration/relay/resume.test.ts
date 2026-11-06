import { describe, expect, test } from 'bun:test'

import {
  connectTestClient,
  memoryStateStore,
  relaySecret,
  relayTicket,
  textOfSyncReply,
  textUpdate,
  until,
  user
} from '#cloud-tests/helpers/relay'
import { COLLAB_ACTIONS, RELAY_CLOSE, RELAY_SERVER_PEER } from '#cloud/contract'
import { createCollaborationRelay, type CollaborationRelay } from '#cloud/server'
import { readRelayPeerState, type RelayPeerState } from '#cloud/server/collaboration/relay/resume'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as Y from 'yjs'

const documentId = crypto.randomUUID()

function hubOver(store: ReturnType<typeof memoryStateStore>['store']) {
  return createCollaborationRelay({
    authSecret: relaySecret,
    store,
    maximumMessageBytes: 1_048_576,
    maximumConnectionsPerRoom: 100,
    persistDelayMs: 0,
    onError: () => undefined
  })
}

/** An editor joined to `hub`, with the state the hub asks its runtime to keep. */
async function joinRemembered(hub: CollaborationRelay, expiresInSeconds?: number) {
  const remembered: { state: RelayPeerState | null } = { state: null }
  const client = connectTestClient((socket) =>
    hub.connect({ ...socket, remember: (state) => (remembered.state = state) })
  )
  client.send({
    type: 'auth',
    token: await relayTicket({
      documentId,
      permission: 'edit',
      principal: user(crypto.randomUUID()),
      expiresInSeconds
    })
  })
  await until(() => client.peerId() !== undefined)
  return { client, remembered }
}

function presence(name: string) {
  const awareness = new awarenessProtocol.Awareness(new Y.Doc())
  awareness.setLocalState({ user: { name } })
  return awarenessProtocol.encodeAwarenessUpdate(awareness, [awareness.clientID])
}

describe('resuming collaboration peers', () => {
  test('keeps what a resumed peer needs, and takes it back without loading the room', async () => {
    const memory = memoryStateStore()
    const first = hubOver(memory.store)
    const alice = await joinRemembered(first)
    const bob = await joinRemembered(first)
    alice.client.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.yjsUpdate,
      target: null,
      payload: textUpdate('kept')
    })
    alice.client.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.awareness,
      target: null,
      payload: presence('Alice')
    })
    await until(
      async () => (await memory.store.load({ documentId, roomEpoch: 0 })).updates.length > 0
    )
    const aliceState = readRelayPeerState(alice.remembered.state)
    const bobState = readRelayPeerState(bob.remembered.state)
    expect(aliceState?.peerId).toBe(alice.client.peerId())
    expect(aliceState?.presenceClients).toHaveLength(1)
    if (!aliceState || !bobState) throw new Error('Expected kept peer states')

    // The runtime set the relay aside and wakes a new one; the sockets stayed open.
    let loads = 0
    const woken = hubOver({
      ...memory.store,
      async load(room) {
        loads++
        return memory.store.load(room)
      }
    })
    const resumedAlice = connectTestClient((socket) => woken.resume(socket, aliceState))
    const resumedBob = connectTestClient((socket) => woken.resume(socket, bobState))

    resumedAlice.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.awareness,
      target: null,
      payload: presence('Alice')
    })
    expect(resumedBob.messages(COLLAB_ACTIONS.awareness)).toHaveLength(1)
    expect(resumedBob.messages(COLLAB_ACTIONS.awareness)[0]?.from).toBe(aliceState.peerId)
    expect(loads).toBe(0)

    // Asking the relay for the document loads it, and it holds what was saved before.
    resumedBob.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.syncStep1,
      target: RELAY_SERVER_PEER,
      payload: Y.encodeStateVector(new Y.Doc())
    })
    await until(() => resumedBob.messages(COLLAB_ACTIONS.syncReply).length > 0)
    expect(loads).toBe(1)
    expect(
      textOfSyncReply(resumedBob.messages(COLLAB_ACTIONS.syncReply)[0]?.payload ?? new Uint8Array())
    ).toBe('kept')
    await woken.close()
    await first.close()
  })

  test('folds the log into a snapshot when the last resumed peer leaves', async () => {
    const memory = memoryStateStore()
    const first = hubOver(memory.store)
    const alice = await joinRemembered(first)
    alice.client.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.yjsUpdate,
      target: null,
      payload: textUpdate('logged')
    })
    const room = { documentId, roomEpoch: 0 }
    await until(async () => (await memory.store.load(room)).updates.length > 0)
    const aliceState = readRelayPeerState(alice.remembered.state)
    if (!aliceState) throw new Error('Expected a kept peer state')

    // The relay woke for the close alone: nothing loaded the room since.
    const woken = hubOver(memory.store)
    const resumed = connectTestClient((socket) => woken.resume(socket, aliceState))
    resumed.connection.closed()
    await until(async () => (await memory.store.load(room)).updates.length === 0)
    const saved = await memory.store.load(room)
    const document = new Y.Doc()
    Y.applyUpdate(document, saved.snapshot ?? new Uint8Array())
    expect(document.getText('t').toString()).toBe('logged')
    await woken.close()
    await first.close()
  })

  test('closes a peer whose ticket lapsed when it next speaks, instead of sending it edits', async () => {
    const hub = hubOver(memoryStateStore().store)
    const lapsing = await joinRemembered(hub, 1)
    const other = await joinRemembered(hub)
    await Bun.sleep(1100)

    other.client.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.yjsUpdate,
      target: null,
      payload: textUpdate('after expiry')
    })
    expect(lapsing.client.closed?.code).toBe(RELAY_CLOSE.expired)
    expect(lapsing.client.messages(COLLAB_ACTIONS.yjsUpdate)).toHaveLength(0)
    await hub.close()
  })

  test('closes a resumed peer whose ticket lapsed while the relay was set aside', async () => {
    const hub = hubOver(memoryStateStore().store)
    const state: RelayPeerState = {
      peerId: crypto.randomUUID(),
      authorization: {
        roomId: `cloud:${documentId}:0`,
        documentId,
        roomEpoch: 0,
        permission: 'edit',
        principal: user('alice'),
        expiresAt: Date.now() - 1
      },
      presenceClients: []
    }
    const resumed = connectTestClient((socket) => hub.resume(socket, state))
    await until(() => resumed.closed !== null)
    expect(resumed.closed?.code).toBe(RELAY_CLOSE.expired)
    await hub.close()
  })

  test('refuses kept state that is not a peer', () => {
    expect(readRelayPeerState({ peerId: 'not-a-uuid' })).toBeNull()
    expect(readRelayPeerState(null)).toBeNull()
  })
})
