import 'fake-indexeddb/auto'
import { afterEach, describe, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'

import { accountRoomIdentity } from '@/app/cloud/rooms/identity'
import { cloudRoomPermissions } from '@/app/cloud/rooms/live'
import { versionListRevision } from '@/app/cloud/versions/history'
import { useCollabIdentity } from '@/app/collab/identity'
import { openDocumentRoom, roomById, roomForStore } from '@/app/collab/rooms'
import { createEditorStore } from '@/app/editor/session'

import {
  cleanups,
  closeAfterTest,
  joinRoom,
  openedCopies,
  openedTwice,
  openRoom,
  runCleanups,
  startRelay,
  until
} from '#tests/helpers/collab/cloud'

afterEach(runCleanups)

describe('Cloud document rooms, identity', () => {
  test('a member is their account in the room, in every tab', async () => {
    const relay = await startRelay()
    const documentId = crypto.randomUUID()
    const [grace, again] = await openedTwice()
    // The account's name differs from this device's, so the assertions show which one a tab took.
    useCollabIdentity().setName('This device')
    cleanups.push(() => useCollabIdentity().setName(''))
    const account = { id: crypto.randomUUID(), name: 'Grace Hopper' }
    const open = (store: typeof grace) =>
      openRoom(relay, store, {
        documentId,
        name: 'Grace Hopper',
        identity: accountRoomIdentity(account)
      })
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
    const [grace] = await openedTwice()
    const first = openRoom(relay, grace, { documentId, name: 'Grace' })
    await until(() => first.session.roomHasDocument())
    const page = grace.graph.getPages()[0]
    if (!page) throw new Error('Expected a page')
    const dot = grace.graph.createNode('ELLIPSE', page.id, { name: 'Dot' })

    // The saver uploads the document; opening that file numbers its layers afresh.
    const saved = await exportFigFile(grace.graph)
    const reopened = createEditorStore(await parseFigFile(Uint8Array.from(saved).buffer))
    cleanups.push(() => reopened.preparationController.dispose())
    openRoom(relay, reopened, { documentId, name: 'Ada' })
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
    const [grace, earlier, reopened] = await openedCopies(3)
    if (!grace || !earlier || !reopened) throw new Error('Expected three tabs')
    const first = openRoom(relay, grace, { documentId, name: 'Grace' })
    await until(() => first.session.roomHasDocument())
    // An earlier visit leaves this device a saved copy of the room, which the next opens first.
    const visit = joinRoom(relay, earlier, { documentId, name: 'Ada' })
    await until(() => visit.session.hasDocument.value && visit.session.peers.value.length > 0)
    visit.stop()
    visit.session.dispose()

    await until(() => reopened.state.preparation === null)
    // A page the room never had, as the file's own copy of a page can be.
    const stray = reopened.graph.addPage('Stray')
    reopened.state.currentPageId = stray.id
    openRoom(relay, reopened, { documentId, name: 'Ada' })
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
    const room = openRoom(relay, grace, { documentId, name: 'Grace', permission: 'view' })
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
    const room = openRoom(relay, grace, { documentId, name: 'Grace' })
    expect(room.session).not.toBe(elsewhere)
    expect(roomForStore(grace)?.roomId).toBe(`cloud:${documentId}:0`)
    expect(roomById(elsewhere.roomId)).toBeUndefined()
  })
})

describe('Cloud document rooms, opening', () => {
  test('a tab whose layers the room holds as they are gets no updates and stays saved', async () => {
    const relay = await startRelay()
    const documentId = crypto.randomUUID()
    const [grace, ada] = await openedTwice()
    const first = openRoom(relay, grace, { documentId, name: 'Grace' })
    await until(() => first.session.roomHasDocument())
    await until(() => ada.state.preparation === null)
    // The room replays every layer to a newcomer; layers that already read the same are no edit.
    const updated: string[] = []
    ada.onEditorEvent('node:updated', (id) => updated.push(id))
    const second = joinRoom(relay, ada, { documentId, name: 'Ada' })
    // The reply is applied before onSynced fires, so the check below sees the replay.
    let synced = false
    cleanups.push(
      second.session.onSynced(() => {
        synced = true
      })
    )
    closeAfterTest(second)
    await until(() => synced)
    expect(updated).toEqual([])
    expect(ada.hasUnsavedChanges()).toBe(false)
  })
})
