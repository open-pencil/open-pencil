import 'fake-indexeddb/auto'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

import { createEditorStore, type EditorStore } from '@/app/editor/session'
import { createMemoryLocalCanvasStore } from '@/app/storage/local-store'
import { resetLocalCanvasStoreForTests } from '@/app/storage/local-store/store'
import { emitStorageWorkspaceEvent } from '@/app/storage/workspace/events'

import {
  cleanups,
  closeAfterTest,
  joinRoom,
  openedTwice,
  openRoom,
  runCleanups,
  startRelay,
  until
} from '#tests/helpers/collab/cloud'

afterEach(runCleanups)

describe('Cloud document rooms, live order', () => {
  test('a shape drawn before someone joins is still there for both', async () => {
    const relay = await startRelay()
    // Rooms keep a saved copy per room, so each test gets a document of its own.
    const documentId = crypto.randomUUID()
    await initCodec()
    const grace = createEditorStore(new SceneGraph())
    cleanups.push(() => grace.preparationController.dispose())
    const first = openRoom(relay, grace, { documentId, name: 'Grace' })
    await until(() => first.session.roomHasDocument())
    const page = grace.graph.getPages()[0]
    if (!page) throw new Error('Expected a page')
    grace.graph.createNode('RECTANGLE', page.id, { name: 'Card' })

    const bytes = await exportFigFile(grace.graph)
    const ada = createEditorStore(await parseFigFile(Uint8Array.from(bytes).buffer))
    cleanups.push(() => ada.preparationController.dispose())
    const second = joinRoom(relay, ada, { documentId, name: 'Ada' })
    let synced = false
    cleanups.push(
      second.session.onSynced(() => {
        synced = true
      })
    )
    closeAfterTest(second)
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
    const [grace, ada] = await openedTwice()
    const first = openRoom(relay, grace, { documentId, name: 'Grace' })
    await until(() => first.session.roomHasDocument())
    await until(() => ada.state.preparation === null)
    openRoom(relay, ada, { documentId, name: 'Ada' })
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
    const grace = createEditorStore(new SceneGraph())
    cleanups.push(() => grace.preparationController.dispose())
    const first = openRoom(relay, grace, { documentId, name: 'Grace' })
    const page = grace.graph.getPages()[0]
    if (!page) throw new Error('Expected a page')
    grace.graph.createNode('RECTANGLE', page.id, { id: 'early:card', name: 'Card' })
    await until(() => first.session.roomHasDocument())
    expect(grace.graph.getNode('early:card')?.parentId).toBe(page.id)

    const watcher = createEditorStore(new SceneGraph())
    cleanups.push(() => watcher.preparationController.dispose())
    openRoom(relay, watcher, { documentId, name: 'Ada' })
    await until(() => watcher.graph.getNode('early:card') !== undefined)
  })
})

describe('Cloud document rooms, unsaved edits', () => {
  /** Grace's tab seeds the room and leaves, after `edit`, so Ada's tab opens it alone and saves. */
  async function reopenAfter(edit: (grace: EditorStore) => void) {
    const relay = await startRelay()
    const documentId = crypto.randomUUID()
    const [grace, ada] = await openedTwice()
    // Opening a stored document marks it saved, so the room takes it as the stored revision.
    await until(() => grace.state.preparation === null)
    grace.markDocumentSaved()
    const first = joinRoom(relay, grace, { documentId, name: 'Grace' })
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
    const second = joinRoom(relay, ada, { documentId, name: 'Ada' })
    cleanups.push(
      second.session.onSynced(() => {
        synced = true
      })
    )
    closeAfterTest(second)
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
