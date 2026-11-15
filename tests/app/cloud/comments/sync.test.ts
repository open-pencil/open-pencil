import 'fake-indexeddb/auto'
import { afterEach, describe, expect, test } from 'bun:test'

import {
  createCommentReply,
  createCommentThread,
  deleteCommentThread,
  readComments,
  writeComments
} from '@open-pencil/scene-graph/comments'

import { followCloudComments, type CloudCommentTarget } from '@/app/cloud/comments/sync'
import type { EditorStore } from '@/app/editor/session'
import { createEditorStore } from '@/app/editor/session/create'

import { COMMENT_TIME as NOW, commentServer } from '#tests/helpers/cloud/comments'

const stores: EditorStore[] = []
const followers: ReturnType<typeof followCloudComments>[] = []

afterEach(() => {
  for (const follower of followers.splice(0)) follower.stop()
  for (const store of stores.splice(0)) store.preparationController.dispose()
})

function open(server: ReturnType<typeof commentServer>, target: Partial<CloudCommentTarget> = {}) {
  const store = createEditorStore()
  stores.push(store)
  const follow = () => {
    const follower = followCloudComments(store, {
      key: 'test',
      requests: async () => server.requests,
      ...target
    })
    followers.push(follower)
    return follower
  }
  return { store, follow, pageId: store.state.currentPageId }
}

function texts(store: EditorStore) {
  return readComments(store.graph).map((thread) => [
    thread.author,
    thread.text,
    ...thread.replies.map((reply) => reply.text)
  ])
}

function addThread(store: EditorStore, pageId: string, text: string) {
  const thread = createCommentThread(store.graph, {
    pageId,
    at: { x: 4, y: 4 },
    author: { name: 'Ana' },
    text,
    now: NOW
  })
  writeComments(store.graph, [...readComments(store.graph), thread])
  return thread
}

describe('Cloud comments in a tab', () => {
  test('show what the server keeps, not what the file carried', async () => {
    const server = commentServer()
    const { store, follow, pageId } = open(server)
    server.others(pageId, 'From the server')
    // As the file the tab opened held it, which is no edit.
    store.adoptChanges(() => addThread(store, pageId, 'From an old file'))
    expect(store.hasUnsavedChanges()).toBe(false)
    const follower = follow()
    await follower.idle()
    expect(texts(store)).toEqual([['Ben', 'From the server']])
    expect(server.calls).toEqual(['list'])
    // Showing them is no edit of the document's.
    expect(store.hasUnsavedChanges()).toBe(false)
  })

  test('send what the tab writes, under the ID it chose, and show the server’s copy', async () => {
    const server = commentServer()
    const { store, follow, pageId } = open(server)
    const follower = follow()
    await follower.idle()
    const thread = addThread(store, pageId, 'Tighten it')
    await follower.idle()
    expect(server.threads.get(thread.id)?.comments[0]?.body).toBe('Tighten it')

    const [current] = readComments(store.graph)
    if (!current) throw new Error('The thread is missing')
    const reply = createCommentReply({ name: 'Ana' }, 'And the body', NOW)
    writeComments(store.graph, [{ ...current, replies: [reply] }])
    await follower.idle()
    expect(texts(store)).toEqual([['Ana', 'Tighten it', 'And the body']])
    expect(server.calls).toEqual(['list', 'create', 'reply'])

    writeComments(store.graph, readComments(store.graph).map(deleteCommentThread))
    await follower.idle()
    expect(server.threads.size).toBe(0)
    expect(readComments(store.graph)).toEqual([])
  })

  test('take back a change the server refuses, and send it only once', async () => {
    const server = commentServer()
    const { store, follow, pageId } = open(server)
    server.others(pageId, 'Ben’s words')
    const follower = follow()
    await follower.idle()
    const [theirs] = readComments(store.graph)
    if (!theirs) throw new Error('The thread is missing')
    writeComments(store.graph, [{ ...theirs, text: 'Words put in Ben’s mouth' }])
    await follower.idle()
    expect(texts(store)).toEqual([['Ben', 'Ben’s words']])
    expect(server.calls.filter((call) => call === 'edit')).toHaveLength(1)
  })

  test('fetch a thread someone else changed when the room says so', async () => {
    const server = commentServer()
    const { store, follow, pageId } = open(server)
    const follower = follow()
    await follower.idle()
    const id = server.others(pageId, 'Just now')
    await follower.changed(id)
    expect(texts(store)).toEqual([['Ben', 'Just now']])
  })

  test('bring the file’s comments along when the document is new on the server', async () => {
    const server = commentServer()
    const imported: string[] = []
    const { store, follow, pageId } = open(server, {
      importer: async () => async (input) => {
        for (const thread of input.threads) imported.push(thread.comments[0]?.authorName ?? '')
        return { threads: [], access: { canComment: true, canModerate: true } }
      }
    })
    const thread = createCommentThread(store.graph, {
      pageId,
      at: { x: 1, y: 1 },
      author: { name: 'Carol' },
      text: 'From the file',
      now: NOW
    })
    writeComments(store.graph, [thread])
    const follower = follow()
    await follower.idle()
    // Under the name the file gave, never as whoever saved it.
    expect(imported).toEqual(['Carol'])
    expect(server.calls).toEqual(['list'])
  })
})
