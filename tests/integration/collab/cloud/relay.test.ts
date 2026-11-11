import 'fake-indexeddb/auto'
import { afterEach, describe, expect, test } from 'bun:test'

import { compact } from 'es-toolkit'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as Y from 'yjs'

import type { DocumentPermission } from '@open-pencil/cloud/contract'

import { connectCollabRoom } from '@/app/collab/room/connection'

import {
  cleanups,
  openedCopies,
  openedTwice,
  openRoom,
  runCleanups,
  startRelay,
  until,
  type Relay
} from '#tests/helpers/collab/cloud'
import { startTestRelay } from '#tests/helpers/collab/relay-server'

const documentId = crypto.randomUUID()
const roomId = `cloud:${documentId}:0`

afterEach(runCleanups)

function joinAs(relay: Relay, name: string, permission: DocumentPermission) {
  const ydoc = new Y.Doc()
  const awareness = new awarenessProtocol.Awareness(ydoc)
  const join = relay.join(documentId, name, permission)
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
    const relay = await startRelay()
    const alice = joinAs(relay, 'Alice', 'edit')
    await until(() => alice.connection.room.signalingConnected())
    alice.ydoc.getText('t').insert(0, 'hello')

    const bob = joinAs(relay, 'Bob', 'edit')
    await until(() => bob.text() === 'hello')
    bob.ydoc.getText('t').insert(5, ' world')
    await until(() => alice.text() === 'hello world')

    await alice.leave()
    await bob.leave()
    const carol = joinAs(relay, 'Carol', 'view')
    await until(() => carol.text() === 'hello world')
  })

  test('viewers receive edits but their own never reach anyone', async () => {
    const relay = await startRelay()
    const { rooms } = relay
    const editor = joinAs(relay, 'Editor', 'edit')
    const viewer = joinAs(relay, 'Viewer', 'view')
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
    await until(() => [...rooms.values()].some((room) => room.snapshot !== null))
    const saved = new Y.Doc()
    for (const room of rooms.values()) {
      if (room.snapshot) Y.applyUpdate(saved, room.snapshot)
      for (const update of room.updates) Y.applyUpdate(saved, update)
    }
    expect(saved.getText('t').toString()).toBe('kept')
  })

  test('presence carries the name on the ticket, not the one a peer claims', async () => {
    const relay = await startRelay()
    const editor = joinAs(relay, 'Editor', 'edit')
    const guest = joinAs(relay, 'Grace', 'view')
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

describe('Cloud document rooms', () => {
  test('tabs that opened the stored file edit one document, and one of them saves', async () => {
    const relay = await startRelay()
    // Rooms keep a saved copy per room, so each test gets a document of its own.
    const documentId = crypto.randomUUID()
    const [grace, ada] = await openedTwice()
    const first = openRoom(relay, grace, { documentId, name: 'Grace' })
    await until(() => first.session.roomHasDocument())
    const second = openRoom(relay, ada, { documentId, name: 'Ada' })
    await until(() => second.session.hasDocument.value && second.session.peers.value.length > 0)

    const page = ada.graph.getPages()[0]
    if (!page) throw new Error('Expected a page')
    ada.graph.createNode('ELLIPSE', page.id, { id: 'from:ada', name: 'Dot' })
    await until(() => grace.graph.getNode('from:ada') !== undefined)
    await until(() => first.session.peers.value.length > 0)
    expect(compact([grace.state.autosaveEnabled, ada.state.autosaveEnabled])).toHaveLength(1)
    // The document lives in its room, so neither tab offers leaving it.
    expect([first.session.leavable, second.session.leavable]).toEqual([false, false])
  })

  test('a tab says the room keeps its edits only while the relay is in the room', async () => {
    const relay = await startTestRelay()
    const documentId = crypto.randomUUID()
    const [grace] = await openedCopies(1)
    if (!grace) throw new Error('Expected a tab')
    openRoom(relay, grace, { documentId, name: 'Grace' })
    expect(grace.state.roomKeepsEdits).toBe(false)
    await until(() => grace.state.roomKeepsEdits)
    // The relay goes away, and with it the log that kept the tab's edits.
    await relay.close()
    await until(() => !grace.state.roomKeepsEdits)
  })

  test('a tab that does not save has the saver upload its latest edit', async () => {
    const relay = await startRelay()
    const documentId = crypto.randomUUID()
    const [grace, ada] = await openedTwice()
    const uploaded: boolean[] = []
    const open = (store: typeof grace, name: string) =>
      openRoom(relay, store, {
        documentId,
        name,
        uploadNow: async () => {
          uploaded.push(store.graph.getNode('late:edit') !== undefined)
          return true
        }
      })
    const first = open(grace, 'Grace')
    await until(() => first.session.roomHasDocument())
    const second = open(ada, 'Ada')
    await until(() => first.session.peers.value.length > 0 && second.session.peers.value.length > 0)
    await until(() => grace.state.autosaveEnabled !== ada.state.autosaveEnabled)

    const [other, room] = grace.state.autosaveEnabled ? [ada, second] : [grace, first]
    const page = other.graph.getPages()[0]
    if (!page) throw new Error('Expected a page')
    other.graph.createNode('ELLIPSE', page.id, { id: 'late:edit', name: 'Dot' })
    expect(await room.upload()).toBe(true)
    expect(uploaded).toEqual([true])
  })
})
