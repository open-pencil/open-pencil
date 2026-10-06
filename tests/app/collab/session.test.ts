import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { openRoomSession, type RoomSession, type RoomSessionOptions } from '@/app/collab/session'
import { createEditorStore, type EditorStore } from '@/app/editor/session'
import { presenceOf } from '@/app/presence/registry'

import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'
import { createMemoryRooms } from '#tests/helpers/collab/memory-transport'

const ROOM_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const ROOM_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

const noSavedCopy = () => ({ whenSynced: Promise.resolve(), destroy: () => undefined })

async function withRooms(
  run: (
    open: (options: Omit<RoomSessionOptions, 'joinRoom'>) => RoomSession,
    settle: () => Promise<void>
  ) => Promise<void>
) {
  const rooms = createMemoryRooms()
  const sessions: RoomSession[] = []
  const stores: EditorStore[] = []
  try {
    await run((options) => {
      stores.push(options.store)
      const session = openRoomSession({
        openSavedCopy: noSavedCopy,
        ...options,
        joinRoom: rooms.join
      })
      sessions.push(session)
      return session
    }, rooms.settle)
  } finally {
    for (const session of sessions) session.dispose()
    for (const store of stores) store.preparationController.dispose()
  }
}

function newStore(name = 'Untitled') {
  const store = createEditorStore(new SceneGraph())
  store.state.documentName = name
  return store
}

function firstPageId(store: EditorStore) {
  return expectDefined(store.graph.getPages()[0], 'first page').id
}

describe('room sessions', () => {
  test("a joined tab shows the sharer's document, with its name, once it arrives", async () => {
    await withRooms(async (open, settle) => {
      const host = newStore('Checkout flow')
      host.graph.createNode('RECTANGLE', firstPageId(host), { id: 'host:1', name: 'Card' })
      const shared = open({ roomId: ROOM_A, store: host, origin: 'shared' })
      shared.shareDocument()
      const guest = newStore('Shared file')
      const joined = open({ roomId: ROOM_A, store: guest, origin: 'joined' })
      expect(joined.status.value).toBe('connecting')

      await settle()
      expect(joined.status.value).toBe('live')
      expect(shared.status.value).toBe('live')
      expect(guest.graph.rootId).toBe(host.graph.rootId)
      expect(getNodeOrThrow(guest.graph, 'host:1').name).toBe('Card')
      expect(guest.state.documentName).toBe('Checkout flow')
    })
  })

  test('a room nobody with the document is in waits, then opens when the sharer comes', async () => {
    await withRooms(async (open, settle) => {
      const guest = newStore()
      const joined = open({ roomId: ROOM_A, store: guest, origin: 'joined' })
      await settle()
      expect(joined.status.value).toBe('waiting')
      expect(joined.hasDocument.value).toBe(false)

      const host = newStore('Late')
      open({ roomId: ROOM_A, store: host, origin: 'shared' }).shareDocument()
      await settle()
      expect(joined.status.value).toBe('live')
      expect(guest.graph.rootId).toBe(host.graph.rootId)
    })
  })

  test('two rooms in two tabs stay apart: edits and cursors reach only their own room', async () => {
    await withRooms(async (open, settle) => {
      const hostA = newStore('A')
      const hostB = newStore('B')
      const roomA = open({ roomId: ROOM_A, store: hostA, origin: 'shared' })
      const roomB = open({ roomId: ROOM_B, store: hostB, origin: 'shared' })
      roomA.shareDocument()
      roomB.shareDocument()
      const guestA = newStore()
      const guestB = newStore()
      const joinedA = open({ roomId: ROOM_A, store: guestA, origin: 'joined' })
      const joinedB = open({ roomId: ROOM_B, store: guestB, origin: 'joined' })
      await settle()

      guestA.graph.createNode('RECTANGLE', firstPageId(guestA), { id: 'guest:a' })
      joinedA.updateCursor(10, 20, firstPageId(guestA))
      await settle()

      expect(hostA.graph.getNode('guest:a')).toBeDefined()
      expect(hostB.graph.getNode('guest:a')).toBeUndefined()
      expect(guestB.graph.getNode('guest:a')).toBeUndefined()
      expect(roomA.peers.value.map((peer) => peer.cursor?.x)).toEqual([10])
      expect(roomB.peers.value.map((peer) => peer.cursor)).toEqual([undefined])
      expect(joinedB.status.value).toBe('live')
    })
  })

  test('an edit in a tab whose room has no document yet stays in that tab', async () => {
    await withRooms(async (open, settle) => {
      const guest = newStore()
      open({ roomId: ROOM_A, store: guest, origin: 'joined' })
      guest.graph.createNode('RECTANGLE', firstPageId(guest), { id: 'early' })
      await settle()

      const host = newStore()
      open({ roomId: ROOM_A, store: host, origin: 'shared' }).shareDocument()
      await settle()
      expect(host.graph.getNode('early')).toBeUndefined()
    })
  })

  test('peers say whether they have the file, so a newcomer knows whom it is waiting for', async () => {
    await withRooms(async (open, settle) => {
      const host = newStore('Shared')
      open({ roomId: ROOM_A, store: host, origin: 'shared' }).shareDocument()
      const early = open({ roomId: ROOM_B, store: newStore(), origin: 'joined' })
      const other = open({ roomId: ROOM_B, store: newStore(), origin: 'joined' })
      const guest = open({ roomId: ROOM_A, store: newStore(), origin: 'joined' })
      await settle()

      expect(guest.peers.value.map((peer) => peer.hasFile)).toEqual([true])
      expect(early.peers.value.map((peer) => peer.hasFile)).toEqual([false])
      expect(early.status.value).toBe('waiting')
      expect(other.status.value).toBe('waiting')
    })
  })

  test('a room a tab has left no longer changes that tab or its people', async () => {
    await withRooms(async (open, settle) => {
      const host = newStore('Shared')
      const shared = open({ roomId: ROOM_A, store: host, origin: 'shared' })
      shared.shareDocument()
      const guest = newStore()
      const joined = open({ roomId: ROOM_A, store: guest, origin: 'joined' })
      await settle()
      expect(joined.peers.value).toHaveLength(1)

      joined.dispose()
      host.graph.createNode('RECTANGLE', firstPageId(host), { id: 'after-leave' })
      shared.updateCursor(10, 10, firstPageId(host))
      await settle()
      expect(guest.graph.getNode('after-leave')).toBeUndefined()
      expect(joined.peers.value).toEqual([])
      expect(presenceOf(guest).peers.value).toEqual([])
    })
  })
})
