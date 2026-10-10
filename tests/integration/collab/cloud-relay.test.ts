import 'fake-indexeddb/auto'
import { afterEach, describe, expect, test } from 'bun:test'

import { compact } from 'es-toolkit'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as Y from 'yjs'

import type { DocumentPermission } from '@open-pencil/cloud/contract'
import { exportFigFile, initCodec, parseFigFile } from '@open-pencil/core'
import { SceneGraph } from '@open-pencil/scene-graph'

import { openCloudDocumentRoom } from '@/app/cloud/rooms/live'
import { connectCollabRoom } from '@/app/collab/room/connection'
import { createEditorStore } from '@/app/editor/session'

import { startTestRelay } from '#tests/helpers/collab/relay-server'

type Relay = Awaited<ReturnType<typeof startTestRelay>>

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
  const relay = await startTestRelay()
  cleanups.push(() => relay.close())
  return relay
}

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
    const { states } = relay
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
    await until(() => states.size > 0)
    const saved = new Y.Doc()
    Y.applyUpdate(saved, [...states.values()][0] ?? new Uint8Array())
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

/** Tabs that each opened the same stored file, which gives each its own root. */
async function openedTwice() {
  await initCodec()
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  if (!page) throw new Error('Expected a page')
  graph.createNode('RECTANGLE', page.id, { name: 'Card' })
  const bytes = await exportFigFile(graph)
  const open = async () => createEditorStore(await parseFigFile(Uint8Array.from(bytes).buffer))
  const stores = [await open(), await open()] as const
  for (const store of stores) cleanups.push(() => store.preparationController.dispose())
  return stores
}

describe('Cloud document rooms', () => {
  test('tabs that opened the stored file edit one document, and one of them saves', async () => {
    const relay = await startRelay()
    // Rooms keep a saved copy per room, so each test gets a document of its own.
    const documentId = crypto.randomUUID()
    const roomId = `cloud:${documentId}:0`
    const [grace, ada] = await openedTwice()
    const first = openCloudDocumentRoom(grace, {
      roomId,
      transport: relay.join(documentId, 'Grace', 'edit', 'user'),
      permission: 'edit'
    })
    cleanups.push(() => {
      first.stop()
      first.session.dispose()
    })
    await until(() => first.session.roomHasDocument())
    const second = openCloudDocumentRoom(ada, {
      roomId,
      transport: relay.join(documentId, 'Ada', 'edit', 'user'),
      permission: 'edit'
    })
    cleanups.push(() => {
      second.stop()
      second.session.dispose()
    })
    await until(() => second.session.hasDocument.value && second.session.peers.value.length > 0)

    const page = ada.graph.getPages()[0]
    if (!page) throw new Error('Expected a page')
    ada.graph.createNode('ELLIPSE', page.id, { id: 'from:ada', name: 'Dot' })
    await until(() => grace.graph.getNode('from:ada') !== undefined)
    await until(() => first.session.peers.value.length > 0)
    expect(compact([grace.state.autosaveEnabled, ada.state.autosaveEnabled])).toHaveLength(1)
  })
})

describe('Cloud document rooms, live order', () => {
  test('a shape drawn before someone joins is still there for both', async () => {
    const relay = await startRelay()
    // Rooms keep a saved copy per room, so each test gets a document of its own.
    const documentId = crypto.randomUUID()
    const roomId = `cloud:${documentId}:0`
    await initCodec()
    const grace = createEditorStore(new SceneGraph())
    cleanups.push(() => grace.preparationController.dispose())
    const first = openCloudDocumentRoom(grace, {
      roomId,
      transport: relay.join(documentId, 'Grace', 'edit', 'user'),
      permission: 'edit'
    })
    cleanups.push(() => {
      first.stop()
      first.session.dispose()
    })
    await until(() => first.session.roomHasDocument())
    const page = grace.graph.getPages()[0]
    if (!page) throw new Error('Expected a page')
    grace.graph.createNode('RECTANGLE', page.id, { name: 'Card' })

    const bytes = await exportFigFile(grace.graph)
    const ada = createEditorStore(await parseFigFile(Uint8Array.from(bytes).buffer))
    cleanups.push(() => ada.preparationController.dispose())
    const second = openCloudDocumentRoom(ada, {
      roomId,
      transport: relay.join(documentId, 'Ada', 'edit', 'user'),
      permission: 'edit'
    })
    cleanups.push(() => {
      second.stop()
      second.session.dispose()
    })
    // A joiner keeps its own earlier copy outside the document; only the document's layers count.
    const rectangles = (store: typeof grace) =>
      [...store.graph.getAllNodes()].filter(
        (node) =>
          node.type === 'RECTANGLE' &&
          store.graph.closest(node.id, (ancestor) => ancestor.id === store.graph.rootId)
      ).length
    await until(() => second.session.hasDocument.value && rectangles(ada) === 1)
    // Ada's updates arrive in order, so a copy pushed into the room would land before this marker.
    const adaPage = ada.graph.getPages()[0]
    if (!adaPage) throw new Error('Expected a page')
    ada.graph.createNode('ELLIPSE', adaPage.id, { id: 'from:ada', name: 'Marker' })
    await until(() => grace.graph.getNode('from:ada') !== undefined)
    expect(rectangles(grace)).toBe(1)
    expect(rectangles(ada)).toBe(1)
  })
})

describe('Cloud document rooms, drawing early', () => {
  test('a shape drawn before the relay answers is in the room once it is seeded', async () => {
    const relay = await startRelay()
    const documentId = crypto.randomUUID()
    const roomId = `cloud:${documentId}:0`
    const grace = createEditorStore(new SceneGraph())
    cleanups.push(() => grace.preparationController.dispose())
    const first = openCloudDocumentRoom(grace, {
      roomId,
      transport: relay.join(documentId, 'Grace', 'edit', 'user'),
      permission: 'edit'
    })
    cleanups.push(() => {
      first.stop()
      first.session.dispose()
    })
    const page = grace.graph.getPages()[0]
    if (!page) throw new Error('Expected a page')
    grace.graph.createNode('RECTANGLE', page.id, { id: 'early:card', name: 'Card' })
    await until(() => first.session.roomHasDocument())
    expect(grace.graph.getNode('early:card')?.parentId).toBe(page.id)

    const watcher = createEditorStore(new SceneGraph())
    cleanups.push(() => watcher.preparationController.dispose())
    const second = openCloudDocumentRoom(watcher, {
      roomId,
      transport: relay.join(documentId, 'Ada', 'edit', 'user'),
      permission: 'edit'
    })
    cleanups.push(() => {
      second.stop()
      second.session.dispose()
    })
    await until(() => watcher.graph.getNode('early:card') !== undefined)
  })
})
