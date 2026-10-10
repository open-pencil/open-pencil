import { afterEach, describe, expect, test } from 'bun:test'
import { createServer } from 'node:http'

import * as awarenessProtocol from 'y-protocols/awareness'
import * as Y from 'yjs'

import { RELAY_PATH, type DocumentPermission } from '@open-pencil/cloud/contract'
import { attachCollaborationRelay } from '@open-pencil/cloud/runtime/node'
import {
  createCollaborationRelay,
  signCollaborationTicket,
  type CollaborationStateStore
} from '@open-pencil/cloud/server'

import { connectCollabRoom } from '@/app/collab/room/connection'
import { createCloudRelayJoin } from '@/app/collab/transport/cloud'

const authSecret = 'relay-integration-secret-at-least-32-characters'
const documentId = crypto.randomUUID()
const roomId = `cloud:${documentId}:0`

const cleanups: (() => Promise<void> | void)[] = []

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

async function until(condition: () => boolean, attempts = 500): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (condition()) return
    await new Promise((resolve) => {
      setTimeout(resolve, 2)
    })
  }
  throw new Error('Condition was not met')
}

async function startRelay() {
  const states = new Map<string, Uint8Array>()
  const store: CollaborationStateStore = {
    load: async (room) => states.get(`${room.documentId}:${room.roomEpoch}`) ?? null,
    store: async (room, state) => {
      states.set(`${room.documentId}:${room.roomEpoch}`, state)
    }
  }
  const relay = createCollaborationRelay({
    authSecret,
    store,
    maximumMessageBytes: 1_048_576,
    maximumConnectionsPerRoom: 10,
    persistDelayMs: 0
  })
  const server = createServer()
  const attached = attachCollaborationRelay(server, relay, 1_048_576)
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected a TCP address')
  cleanups.push(async () => {
    await attached.close()
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
  })
  return { url: `ws://127.0.0.1:${address.port}${RELAY_PATH}`, states }
}

function joinAs(url: string, name: string, permission: DocumentPermission) {
  const ydoc = new Y.Doc()
  const awareness = new awarenessProtocol.Awareness(ydoc)
  const join = createCloudRelayJoin({
    url,
    ticket: async () =>
      signCollaborationTicket({
        authSecret,
        documentId,
        principal: { kind: 'guest', guestId: crypto.randomUUID(), name },
        permission,
        roomEpoch: 0,
        relayURL: url
      })
  })
  const connection = connectCollabRoom({
    roomId,
    ydoc,
    awareness,
    updatePeersList: () => undefined,
    joinRoom: join
  })
  const peer = {
    ydoc,
    awareness,
    connection,
    text: () => ydoc.getText('t').toString(),
    async leave() {
      await connection.room.leave()
      awareness.destroy()
      ydoc.destroy()
    }
  }
  cleanups.push(() => peer.leave())
  return peer
}

describe('collaboration through the Cloud relay', () => {
  test('editors sync live and newcomers get the document from the relay', async () => {
    const { url } = await startRelay()
    const alice = joinAs(url, 'Alice', 'edit')
    await until(() => alice.connection.room.signalingConnected())
    alice.ydoc.getText('t').insert(0, 'hello')

    const bob = joinAs(url, 'Bob', 'edit')
    await until(() => bob.text() === 'hello')
    bob.ydoc.getText('t').insert(5, ' world')
    await until(() => alice.text() === 'hello world')

    await alice.leave()
    await bob.leave()
    const carol = joinAs(url, 'Carol', 'view')
    await until(() => carol.text() === 'hello world')
  })

  test('viewers receive edits but their own never reach anyone', async () => {
    const { url, states } = await startRelay()
    const editor = joinAs(url, 'Editor', 'edit')
    const viewer = joinAs(url, 'Viewer', 'view')
    await until(
      () =>
        editor.connection.room.signalingConnected() && viewer.connection.room.signalingConnected()
    )
    viewer.ydoc.getText('t').insert(0, 'vandal ')
    editor.ydoc.getText('t').insert(0, 'kept')
    await until(() => viewer.text().includes('kept'))

    expect(editor.text()).toBe('kept')
    await editor.leave()
    await viewer.leave()
    await until(() => states.size > 0)
    const saved = new Y.Doc()
    Y.applyUpdate(saved, [...states.values()][0] ?? new Uint8Array())
    expect(saved.getText('t').toString()).toBe('kept')
  })

  test('presence carries the name on the ticket, not the one a peer claims', async () => {
    const { url } = await startRelay()
    const editor = joinAs(url, 'Editor', 'edit')
    const guest = joinAs(url, 'Grace', 'view')
    await until(
      () =>
        editor.connection.room.signalingConnected() && guest.connection.room.signalingConnected()
    )
    guest.awareness.setLocalStateField('user', { name: 'Admin', color: '#000' })
    await until(() => editor.awareness.getStates().has(guest.awareness.clientID))
    expect(editor.awareness.getStates().get(guest.awareness.clientID)).toMatchObject({
      user: { name: 'Grace', color: '#000' },
      cloud: { kind: 'guest', name: 'Grace', permission: 'view' }
    })
  })
})
