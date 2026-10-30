import 'fake-indexeddb/auto'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'

import { compact } from 'es-toolkit'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as Y from 'yjs'

import type { DocumentPermission } from '@open-pencil/cloud/contract'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

import { accountRoomIdentity } from '@/app/cloud/rooms/identity'
import { cloudRoomPermissions, openCloudDocumentRoom } from '@/app/cloud/rooms/live'
import { versionListRevision } from '@/app/cloud/versions/history'
import { useCollabIdentity } from '@/app/collab/identity'
import { connectCollabRoom } from '@/app/collab/room/connection'
import { openDocumentRoom, roomById, roomForStore } from '@/app/collab/rooms'
import { createEditorStore, type EditorStore } from '@/app/editor/session'
import { createMemoryLocalCanvasStore } from '@/app/storage/local-store'
import { resetLocalCanvasStoreForTests } from '@/app/storage/local-store/store'
import { emitStorageWorkspaceEvent } from '@/app/storage/workspace/events'

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

describe('Cloud document rooms, identity', () => {
  test('a member is their account in the room, in every tab', async () => {
    const relay = await startRelay()
    const documentId = crypto.randomUUID()
    const [grace, again] = await openedTwice()
    // The account's name differs from this device's, so the assertions show which one a tab took.
    useCollabIdentity().setName('This device')
    cleanups.push(() => useCollabIdentity().setName(''))
    const account = { id: crypto.randomUUID(), name: 'Grace Hopper' }
    const open = (store: typeof grace) => {
      const room = openCloudDocumentRoom(store, {
        roomId: `cloud:${documentId}:0`,
        transport: relay.join(documentId, 'Grace Hopper', 'edit', 'user'),
        permission: 'edit',
        identity: accountRoomIdentity(account)
      })
      cleanups.push(() => {
        room.stop()
        room.session.dispose()
      })
      return room
    }
    const first = open(grace)
    const second = open(again)
    await until(() => first.session.peers.value.length > 0 && second.session.peers.value.length > 0)
    const own = (room: typeof first) => room.session.presence().get(room.session.clientId)?.user
    expect(own(first)).toMatchObject({ name: 'Grace Hopper' })
    expect(own(second)).toEqual(own(first))
    // Each tab sees the other as it presents itself; the name comes from the ticket, which the
    // server takes from the same account.
    const seen = (room: typeof first) =>
      room.session.peers.value.map((peer) => ({ name: peer.name, color: peer.color }))
    expect([own(second)]).toEqual(seen(first))
    expect([own(first)]).toEqual(seen(second))
  })
})

describe('Cloud document rooms, reopening', () => {
  test('a tab that opens the stored file shows the room’s layers, not the file’s copies', async () => {
    const relay = await startRelay()
    const documentId = crypto.randomUUID()
    const roomId = `cloud:${documentId}:0`
    const [grace] = await openedTwice()
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
    const dot = grace.graph.createNode('ELLIPSE', page.id, { name: 'Dot' })

    // The saver uploads the document; opening that file numbers its layers afresh.
    const saved = await exportFigFile(grace.graph)
    const reopened = createEditorStore(await parseFigFile(Uint8Array.from(saved).buffer))
    cleanups.push(() => reopened.preparationController.dispose())
    const second = openCloudDocumentRoom(reopened, {
      roomId,
      transport: relay.join(documentId, 'Ada', 'edit', 'user'),
      permission: 'edit'
    })
    cleanups.push(() => {
      second.stop()
      second.session.dispose()
    })
    await until(() => reopened.graph.getNode(dot.id) !== undefined)
    const layers = (store: typeof grace) =>
      store.graph
        .getPages()
        .flatMap((candidate) => candidate.childIds)
        .map((id) => store.graph.getNode(id)?.name)
        .sort()
    expect(layers(reopened)).toEqual(layers(grace))
  })

  test('a tab left on a page only its file had moves to one of the room’s pages', async () => {
    const relay = await startRelay()
    const documentId = crypto.randomUUID()
    const roomId = `cloud:${documentId}:0`
    const [grace, earlier, reopened] = await openedCopies(3)
    if (!grace || !earlier || !reopened) throw new Error('Expected three tabs')
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
    // An earlier visit leaves this device a saved copy of the room, which the next opens first.
    const visit = openCloudDocumentRoom(earlier, {
      roomId,
      transport: relay.join(documentId, 'Ada', 'edit', 'user'),
      permission: 'edit'
    })
    await until(() => visit.session.hasDocument.value && visit.session.peers.value.length > 0)
    visit.stop()
    visit.session.dispose()

    await until(() => reopened.state.preparation === null)
    // A page the room never had, as the file's own copy of a page can be.
    const stray = reopened.graph.addPage('Stray')
    reopened.state.currentPageId = stray.id
    const second = openCloudDocumentRoom(reopened, {
      roomId,
      transport: relay.join(documentId, 'Ada', 'edit', 'user'),
      permission: 'edit'
    })
    cleanups.push(() => {
      second.stop()
      second.session.dispose()
    })
    await until(() => reopened.graph.getNode(stray.id) === undefined)
    // One of the room's pages, which the tab that seeded the room has too.
    await until(() =>
      grace.graph.getPages().some((page) => page.id === reopened.state.currentPageId)
    )
    expect(reopened.graph.getNode(reopened.state.currentPageId)?.type).toBe('CANVAS')
  })
})

describe('Cloud document rooms, version history', () => {
  test('a tab reloads its history when the server says it changed', async () => {
    const relay = await startRelay()
    const documentId = crypto.randomUUID()
    const [grace] = await openedTwice()
    const room = openCloudDocumentRoom(grace, {
      roomId: `cloud:${documentId}:0`,
      transport: relay.join(documentId, 'Grace', 'view', 'user'),
      permission: 'view'
    })
    cleanups.push(() => {
      room.stop()
      room.session.dispose()
    })
    let joined = false
    room.session.onSynced(() => {
      joined = true
    })
    await until(() => joined)
    const before = versionListRevision(grace)
    relay.announceVersions(documentId)
    await until(() => versionListRevision(grace) > before)

    // Stopping the room leaves the tab as it was before it joined.
    expect([grace.state.hostRestrictions.readOnly, cloudRoomPermissions.value.get(grace)]).toEqual([
      true,
      'view'
    ])
    room.stop()
    expect([grace.state.hostRestrictions.readOnly, cloudRoomPermissions.value.has(grace)]).toEqual([
      false,
      false
    ])
  })
})

describe('Cloud document rooms, another room first', () => {
  test('a tab already in another room moves to its document’s own room', async () => {
    const relay = await startRelay()
    const documentId = crypto.randomUUID()
    const [grace] = await openedTwice()
    // Shared into a room by hand while the document's own was still being asked for.
    const elsewhere = openDocumentRoom(
      grace,
      `cloud:${crypto.randomUUID()}:0`,
      relay.join(documentId, 'Grace', 'edit', 'user')
    )
    const room = openCloudDocumentRoom(grace, {
      roomId: `cloud:${documentId}:0`,
      transport: relay.join(documentId, 'Grace', 'edit', 'user'),
      permission: 'edit'
    })
    cleanups.push(() => {
      room.stop()
      room.session.dispose()
    })
    expect(room.session).not.toBe(elsewhere)
    expect(roomForStore(grace)?.roomId).toBe(`cloud:${documentId}:0`)
    expect(roomById(elsewhere.roomId)).toBeUndefined()
  })
})

describe('Cloud document rooms, opening', () => {
  test('a tab whose layers the room holds as they are gets no updates and stays saved', async () => {
    const relay = await startRelay()
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
    await until(() => ada.state.preparation === null)
    // The room replays every layer to a newcomer; layers that already read the same are no edit.
    const updated: string[] = []
    ada.onEditorEvent('node:updated', (id) => updated.push(id))
    const second = openCloudDocumentRoom(ada, {
      roomId,
      transport: relay.join(documentId, 'Ada', 'edit', 'user'),
      permission: 'edit'
    })
    // The reply is applied before onSynced fires, so the check below sees the replay.
    let synced = false
    cleanups.push(
      second.session.onSynced(() => {
        synced = true
      })
    )
    cleanups.push(() => {
      second.stop()
      second.session.dispose()
    })
    await until(() => synced)
    expect(updated).toEqual([])
    expect(ada.hasUnsavedChanges()).toBe(false)
  })
})

/** Tabs that each opened the same stored file, which gives each its own root. */
/** Tabs that each opened the same stored file. */
async function openedCopies(count: number) {
  await initCodec()
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  if (!page) throw new Error('Expected a page')
  graph.createNode('RECTANGLE', page.id, { name: 'Card' })
  const bytes = await exportFigFile(graph)
  const stores = []
  for (let index = 0; index < count; index++) {
    const store = createEditorStore(await parseFigFile(Uint8Array.from(bytes).buffer))
    cleanups.push(() => store.preparationController.dispose())
    stores.push(store)
  }
  return stores
}

async function openedTwice() {
  const [first, second] = await openedCopies(2)
  if (!first || !second) throw new Error('Expected two tabs')
  return [first, second] as const
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
    // The document lives in its room, so neither tab offers leaving it.
    expect([first.session.leavable, second.session.leavable]).toEqual([false, false])
  })

  test('a tab that does not save has the saver upload its latest edit', async () => {
    const relay = await startRelay()
    const documentId = crypto.randomUUID()
    const roomId = `cloud:${documentId}:0`
    const [grace, ada] = await openedTwice()
    const uploaded: boolean[] = []
    const open = (store: typeof grace, name: string) => {
      const room = openCloudDocumentRoom(store, {
        roomId,
        transport: relay.join(documentId, name, 'edit', 'user'),
        permission: 'edit',
        uploadNow: async () => {
          uploaded.push(store.graph.getNode('late:edit') !== undefined)
          return true
        }
      })
      cleanups.push(() => {
        room.stop()
        room.session.dispose()
      })
      return room
    }
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
    let synced = false
    cleanups.push(
      second.session.onSynced(() => {
        synced = true
      })
    )
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
    await until(() => synced && rectangles(ada) === 1)
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
  test('a shape a joining tab draws before the relay answers reaches the room', async () => {
    const relay = await startRelay()
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
    await until(() => ada.state.preparation === null)
    const second = openCloudDocumentRoom(ada, {
      roomId,
      transport: relay.join(documentId, 'Ada', 'edit', 'user'),
      permission: 'edit'
    })
    cleanups.push(() => {
      second.stop()
      second.session.dispose()
    })
    // The tab shows its stored document at once, so the person may draw before the room arrives.
    const page = ada.graph.getPages()[0]
    if (!page) throw new Error('Expected a page')
    ada.graph.createNode('ELLIPSE', page.id, { id: 'early:ada', name: 'Early' })

    await until(() => grace.graph.getNode('early:ada') !== undefined)
    expect(ada.graph.getNode('early:ada')?.parentId).toBe(page.id)
  })

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

describe('Cloud document rooms, unsaved edits', () => {
  /** Grace's tab seeds the room and leaves, after `edit`, so Ada's tab opens it alone and saves. */
  async function reopenAfter(edit: (grace: EditorStore) => void) {
    const relay = await startRelay()
    const documentId = crypto.randomUUID()
    const roomId = `cloud:${documentId}:0`
    const [grace, ada] = await openedTwice()
    // Opening a stored document marks it saved, so the room takes it as the stored revision.
    await until(() => grace.state.preparation === null)
    grace.markDocumentSaved()
    const first = openCloudDocumentRoom(grace, {
      roomId,
      transport: relay.join(documentId, 'Grace', 'edit', 'user'),
      permission: 'edit'
    })
    await until(() => first.session.roomHasDocument())
    edit(grace)
    first.stop()
    first.session.dispose()

    await until(() => ada.state.preparation === null)
    // The file read back differs from the room's copy, as a value the round trip changes would.
    const card = ada.graph.getPages()[0]?.childIds[0]
    if (!card) throw new Error('Expected a layer')
    ada.graph.updateNode(card, { name: 'Read back' })
    ada.markDocumentSaved()
    let synced = false
    const second = openCloudDocumentRoom(ada, {
      roomId,
      transport: relay.join(documentId, 'Ada', 'edit', 'user'),
      permission: 'edit'
    })
    cleanups.push(
      second.session.onSynced(() => {
        synced = true
      })
    )
    cleanups.push(() => {
      second.stop()
      second.session.dispose()
    })
    await until(() => synced && ada.state.autosaveEnabled)
    return { ada, card, session: second.session }
  }

  test('a tab that takes in the room’s copy of its document has nothing to save', async () => {
    const { ada, card, session } = await reopenAfter(() => undefined)

    expect(ada.graph.getNode(card)?.name).toBe('Card')
    expect(session.saves.unsaved()).toBe(false)
    expect(ada.hasUnsavedChanges()).toBe(false)
  })

  test('the tab that saves next saves edits the room holds unsaved', async () => {
    const { ada, session } = await reopenAfter((grace) => {
      const page = grace.graph.getPages()[0]
      if (!page) throw new Error('Expected a page')
      grace.graph.createNode('ELLIPSE', page.id, { id: 'left:unsaved', name: 'Dot' })
    })

    expect(ada.graph.getNode('left:unsaved')).toBeDefined()
    expect(session.saves.unsaved()).toBe(true)
    expect(ada.hasUnsavedChanges()).toBe(true)
  })

  test('the room’s edits are saved once the saver’s upload of them is on the server', async () => {
    const { ada, session } = await reopenAfter((grace) => {
      const page = grace.graph.getPages()[0]
      if (!page) throw new Error('Expected a page')
      grace.graph.createNode('ELLIPSE', page.id, { name: 'Dot' })
    })
    const local = createMemoryLocalCanvasStore()
    resetLocalCanvasStoreForTests(local)
    cleanups.push(() => resetLocalCanvasStoreForTests())
    const binding = { providerId: 'cloud', documentId: crypto.randomUUID() } as const
    await local.writeCanvas({
      id: binding.documentId,
      providerId: 'cloud',
      name: 'Poster',
      figBytes: new Uint8Array([1]),
      syncStatus: 'pending'
    })
    const bound = spyOn(ada, 'getStorageBinding').mockReturnValue(binding)
    cleanups.push(() => bound.mockRestore())
    // The saver reads whether its upload is on the server; the room hears only after that.
    let reads = 0
    const getMeta = local.getMeta.bind(local)
    const read = spyOn(local, 'getMeta').mockImplementation(async (id) => {
      const meta = await getMeta(id)
      reads++
      return meta
    })
    cleanups.push(() => read.mockRestore())
    // The tab's save landed locally, as autosave leaves it, and is still on its way.
    ada.markDocumentSaved()
    await until(() => reads > 0)
    expect(session.saves.unsaved()).toBe(true)

    await local.updateMeta(binding.documentId, { syncStatus: 'synced' })
    emitStorageWorkspaceEvent({ ...binding, kind: 'changed' })
    await until(() => !session.saves.unsaved())
  })
})
