import { describe, expect, test } from 'bun:test'

import { SceneGraph, type CommentReply, type CommentThread } from '@open-pencil/scene-graph'
import { readComments, writeComments } from '@open-pencil/scene-graph/comments'

import { openRoomSession, type RoomSession } from '@/app/collab/session'
import { createEditorStore, type EditorStore } from '@/app/editor/session'

import { expectDefined } from '#tests/helpers/assert'
import { createMemoryRooms } from '#tests/helpers/collab/memory-transport'

const ROOM = 'dddddddddddddddddddddddddddddddd'

const noSavedCopy = () => ({ whenSynced: Promise.resolve(), destroy: () => undefined })

function thread(id: string, author: string, replies: CommentReply[] = []): CommentThread {
  return {
    id,
    pageId: '0:1',
    x: 0,
    y: 0,
    author,
    text: `${author} says hi`,
    createdAt: '2026-10-22T10:00:00.000Z',
    updatedAt: '2026-10-22T10:00:00.000Z',
    resolved: false,
    replies
  }
}

function reply(id: string, author: string, minute: number): CommentReply {
  return { id, author, text: `${author} replies`, createdAt: `2026-10-22T10:0${minute}:00.000Z` }
}

/** Adds a thread to the document as the comments panel does: on top of what it holds now. */
function comment(store: EditorStore, next: CommentThread) {
  writeComments(store.graph, [...readComments(store.graph), next])
}

function replyTo(store: EditorStore, threadId: string, next: CommentReply) {
  writeComments(
    store.graph,
    readComments(store.graph).map((item) =>
      item.id === threadId ? { ...item, replies: [...item.replies, next] } : item
    )
  )
}

const threadIds = (store: EditorStore) => readComments(store.graph).map((item) => item.id)

type Room = {
  host: EditorStore
  guest: EditorStore
  hostSession: RoomSession
  guestSession: RoomSession
  settle: () => Promise<void>
}

/**
 * A host shares a document with one comment thread, and whatever `prepare` adds; a guest joins.
 */
async function withRoom(
  run: (room: Room) => Promise<void>,
  prepare: (host: EditorStore) => void = () => undefined
) {
  const rooms = createMemoryRooms()
  const sessions: RoomSession[] = []
  const host = createEditorStore(new SceneGraph())
  const guest = createEditorStore(new SceneGraph())
  try {
    comment(host, thread('t1', 'Ann'))
    prepare(host)
    const open = (store: EditorStore, origin: 'shared' | 'joined') => {
      const session = openRoomSession({
        roomId: ROOM,
        store,
        origin,
        joinRoom: rooms.join,
        openSavedCopy: noSavedCopy
      })
      sessions.push(session)
      return session
    }
    const hostSession = open(host, 'shared')
    hostSession.shareDocument()
    const guestSession = open(guest, 'joined')
    await rooms.settle()
    await run({ host, guest, hostSession, guestSession, settle: rooms.settle })
  } finally {
    for (const session of sessions) session.dispose()
    host.preparationController.dispose()
    guest.preparationController.dispose()
  }
}

describe('document data in a room', () => {
  test('a peer that joins gets the comments the document holds', async () => {
    await withRoom(async ({ guest }) => {
      expect(threadIds(guest)).toEqual(['t1'])
      expect(readComments(guest.graph)[0]?.author).toBe('Ann')
    })
  })

  test('people commenting at once all keep their threads', async () => {
    await withRoom(async ({ host, guest, settle }) => {
      comment(host, thread('t2', 'Ann'))
      comment(guest, thread('t3', 'Ben'))
      await settle()
      expect(threadIds(host).toSorted()).toEqual(['t1', 't2', 't3'])
      expect(threadIds(guest).toSorted()).toEqual(['t1', 't2', 't3'])
    })
  })

  test('people replying to one thread at once all keep their replies', async () => {
    await withRoom(async ({ host, guest, settle }) => {
      replyTo(host, 't1', reply('r1', 'Ann', 1))
      replyTo(guest, 't1', reply('r2', 'Ben', 2))
      await settle()
      for (const store of [host, guest]) {
        const replies = expectDefined(readComments(store.graph)[0], 'thread').replies
        expect(replies.map((item) => item.id)).toEqual(['r1', 'r2'])
      }
    })
  })

  test('a file setting changed while someone comments keeps both', async () => {
    await withRoom(async ({ host, guest, settle }) => {
      host.setFigCompression('smallest')
      comment(guest, thread('t2', 'Ben'))
      await settle()
      expect(guest.figCompression()).toBe('smallest')
      expect(threadIds(host).toSorted()).toEqual(['t1', 't2'])
    })
  })

  test('libraries and the color space reach the other peer', async () => {
    await withRoom(async ({ host, guest, settle }) => {
      guest.updateEnabledLibraries((bindings) =>
        bindings.set('lib-1', { libraryId: 'lib-1', revisionId: 'rev-1', enabled: true })
      )
      host.setDocumentColorSpace('display-p3')
      await settle()
      expect(host.graph.enabledLibraries.get('lib-1')?.revisionId).toBe('rev-1')
      expect(guest.graph.documentColorSpace).toBe('display-p3')
    })
  })

  test('a peer that joins takes the libraries and color space without sending its own back', async () => {
    await withRoom(
      async ({ host, guest, guestSession }) => {
        // Taking the room's document is no edit of the guest's own.
        expect([...guestSession.saves.counts().values()]).toHaveLength(1)
        for (const store of [host, guest]) {
          expect(store.graph.enabledLibraries.get('lib-1')?.revisionId).toBe('rev-1')
          expect(store.graph.documentColorSpace).toBe('display-p3')
        }
      },
      (host) => {
        host.updateEnabledLibraries((bindings) =>
          bindings.set('lib-1', { libraryId: 'lib-1', revisionId: 'rev-1', enabled: true })
        )
        host.setDocumentColorSpace('display-p3')
      }
    )
  })

  test('a viewer takes peers’ libraries and color space', async () => {
    await withRoom(async ({ host, guest, settle }) => {
      guest.setReadOnly(true)
      host.updateEnabledLibraries((bindings) =>
        bindings.set('lib-1', { libraryId: 'lib-1', revisionId: 'rev-1', enabled: true })
      )
      host.setDocumentColorSpace('display-p3')
      await settle()
      expect(guest.graph.enabledLibraries.get('lib-1')?.revisionId).toBe('rev-1')
      expect(guest.graph.documentColorSpace).toBe('display-p3')
    })
  })

  test('a color space change is an edit the room has not saved', async () => {
    await withRoom(async ({ host, hostSession }) => {
      hostSession.saves.markSaved(hostSession.saves.counts())
      expect(hostSession.saves.unsaved()).toBe(false)
      host.setDocumentColorSpace('display-p3')
      expect(hostSession.saves.unsaved()).toBe(true)
    })
  })

  test("a joining tab's own settings stay out of the room until it shows the room's document", async () => {
    const rooms = createMemoryRooms()
    const host = createEditorStore(new SceneGraph())
    const guest = createEditorStore(new SceneGraph())
    const open = (store: EditorStore, origin: 'shared' | 'joined') =>
      openRoomSession({
        roomId: ROOM,
        store,
        origin,
        joinRoom: rooms.join,
        openSavedCopy: noSavedCopy
      })
    const sessions = [open(host, 'shared')]
    try {
      sessions[0]?.shareDocument()
      sessions.push(open(guest, 'joined'))
      guest.updateEnabledLibraries((bindings) =>
        bindings.set('own', { libraryId: 'own', revisionId: 'rev-1', enabled: true })
      )
      await rooms.settle()
      expect(host.graph.enabledLibraries.has('own')).toBe(false)
    } finally {
      for (const session of sessions) session.dispose()
      host.preparationController.dispose()
      guest.preparationController.dispose()
    }
  })
})
