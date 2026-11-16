import 'fake-indexeddb/auto'
import { afterEach, describe, expect, test } from 'bun:test'

import * as v from 'valibot'

import { CloudAPIError } from '@open-pencil/cloud/client'
import {
  CLOUD_API_MAX_BODY_BYTES,
  importCommentThreadsSchema,
  type ImportCommentThreadsInput
} from '@open-pencil/cloud/contract'
import {
  createCommentReply,
  createCommentThread,
  deleteCommentThread,
  readComments,
  writeComments
} from '@open-pencil/scene-graph/comments'

import { followCloudComments, type CloudCommentTarget } from '@/app/cloud/comments/sync'
import { commentsKeptElsewhere } from '@/app/comments/document'
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
        return { threads: [], access: { canComment: true, canModerate: true, accountId: null } }
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

  test('load the document when the server refuses part of the file’s comments', async () => {
    const server = commentServer()
    const sent: number[] = []
    const { store, follow, pageId } = open(server, {
      importer: async () => async (input) => {
        sent.push(input.threads.length)
        throw new CloudAPIError('too large', 413, 'invalid_request')
      }
    })
    addThread(store, pageId, 'From the file')
    const follower = follow()
    await follower.idle()
    // Refused once, never sent again; the tab can comment on what the server holds.
    expect(sent).toEqual([1])
    expect(commentsKeptElsewhere.value.get(store)?.canComment).toBe(true)
  })

  test('split a file’s comments into imports the server takes', async () => {
    const server = commentServer()
    const sent: ImportCommentThreadsInput[] = []
    const { store, follow, pageId } = open(server, {
      importer: async () => async (input) => {
        sent.push(input)
        return { threads: [], access: { canComment: true, canModerate: true, accountId: null } }
      }
    })
    // About 10 MB of comments, more than the server takes in one request.
    const text = '😀'.repeat(4_000)
    writeComments(
      store.graph,
      Array.from({ length: 600 }, () =>
        createCommentThread(store.graph, {
          pageId,
          at: { x: 1, y: 1 },
          author: { name: 'Carol' },
          text,
          now: NOW
        })
      )
    )
    const follower = follow()
    await follower.idle()
    expect(sent.length).toBeGreaterThan(1)
    expect(sent.reduce((total, input) => total + input.threads.length, 0)).toBe(600)
    // Each one is a request the server takes, by its schema and by its size.
    for (const input of sent) {
      expect(v.is(importCommentThreadsSchema, input)).toBe(true)
      expect(new TextEncoder().encode(JSON.stringify(input)).length).toBeLessThanOrEqual(
        CLOUD_API_MAX_BODY_BYTES
      )
    }
  })

  test('send whom a comment names, and tell the UI what is new until it is read', async () => {
    const server = commentServer()
    const { store, follow, pageId } = open(server, {
      people: async () => [{ id: 'acc-ben', name: 'Ben', image: null }]
    })
    const id = server.others(pageId, 'New to you')
    const follower = follow()
    await follower.idle()
    const kept = () => commentsKeptElsewhere.value.get(store)
    expect(kept()?.unread.has(id)).toBe(true)
    expect(await kept()?.people()).toEqual([{ id: 'acc-ben', name: 'Ben', image: null }])

    kept()?.markRead(id)
    expect(kept()?.unread.has(id)).toBe(false)
    await follower.idle()
    expect(server.calls).toContain('read')

    const mine = addThread(store, pageId, '[@Ben](openpencil://person/acc-ben) look')
    await follower.idle()
    expect(server.threads.get(mine.id)?.comments[0]?.mentions).toEqual(['acc-ben'])
  })

  test('keep sending after a document change that touched no comment', async () => {
    const server = commentServer()
    const { store, follow, pageId } = open(server)
    const follower = follow()
    await follower.idle()
    // Plugin data on the document node changes, comments do not: nothing to send.
    const root = store.graph.getNode(store.graph.rootId)
    store.graph.updateNode(store.graph.rootId, {
      pluginData: [...(root?.pluginData ?? []), { pluginId: 'test', key: 'k', value: 'v' }]
    })
    await follower.idle()
    const thread = addThread(store, pageId, 'Still heard')
    await follower.idle()
    expect(server.threads.has(thread.id)).toBe(true)
  })

  test('show what someone else changed, never send the old words back', async () => {
    const server = commentServer()
    const { store, follow, pageId } = open(server)
    const id = server.others(pageId, 'First words')
    const follower = follow()
    await follower.idle()
    const stored = server.threads.get(id)
    const [first] = stored?.comments ?? []
    if (!stored || !first) throw new Error('The thread is missing')
    // Ben changes his words in another tab; this tab still shows the old ones.
    server.threads.set(id, { ...stored, comments: [{ ...first, body: 'Second words' }] })
    await follower.changed(id)
    expect(texts(store)).toEqual([['Ben', 'Second words']])
    expect(server.calls).not.toContain('edit')
  })
})
