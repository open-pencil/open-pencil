import { describe, expect, test } from 'bun:test'

import * as v from 'valibot'

import {
  COMMENT_BODY_MAX_LENGTH,
  COMMENT_NAME_MAX_LENGTH,
  importCommentThreadsSchema,
  type CloudCommentThread
} from '@open-pencil/cloud/contract'
import type { CommentThread } from '@open-pencil/scene-graph'

import {
  acknowledged,
  cloudCommentChanges,
  documentThread,
  importedThreads
} from '@/app/cloud/comments/threads'

const THREAD = '00000000-0000-4000-8000-000000000001'
const FIRST = '00000000-0000-4000-8000-000000000002'
const REPLY = '00000000-0000-4000-8000-000000000003'

const stored: CloudCommentThread = {
  id: THREAD,
  pageId: '0:1',
  pageName: 'Page 1',
  nodeId: '1:2',
  nodeName: 'Hero',
  offsetX: 4,
  offsetY: 8,
  x: 104,
  y: 208,
  createdAt: '2026-11-16T10:00:00.000Z',
  updatedAt: '2026-11-16T10:05:00.000Z',
  resolvedAt: null,
  resolvedBy: null,
  createdBy: 'ana',
  unread: false,
  comments: [
    {
      id: FIRST,
      author: { kind: 'user', id: 'ana', name: 'Ana' },
      agent: null,
      body: 'Tighten the heading',
      mentions: [],
      createdAt: '2026-11-16T10:00:00.000Z',
      editedAt: null
    },
    {
      id: REPLY,
      author: { kind: 'user', id: 'gone', name: null },
      agent: 'Claude',
      body: 'Done',
      mentions: [],
      createdAt: '2026-11-16T10:05:00.000Z',
      editedAt: null
    }
  ]
}

const server = (...threads: CloudCommentThread[]) => new Map(threads.map((t) => [t.id, t]))

describe('Cloud comment threads', () => {
  test('read as the document holds them, a deleted account as nobody', () => {
    expect(documentThread(stored)).toMatchObject({
      id: THREAD,
      author: 'Ana',
      text: 'Tighten the heading',
      nodeId: '1:2',
      offsetX: 4,
      resolved: false,
      replies: [{ id: REPLY, author: '', agent: 'Claude', text: 'Done' }]
    })
  })

  test('send nothing when the document holds what the server does', () => {
    expect(cloudCommentChanges([documentThread(stored)], server(stored))).toEqual([])
  })

  test('never delete what the document only lacks, as a file opened in its place does', () => {
    const withoutReply = { ...documentThread(stored), replies: [] }
    expect(cloudCommentChanges([], server(stored))).toEqual([])
    expect(cloudCommentChanges([withoutReply], server(stored))).toEqual([])
  })

  test('send new threads with their replies, and deletions by their tombstones', () => {
    const local = documentThread(stored)
    const fresh: CommentThread = {
      ...local,
      id: 'new',
      resolved: true,
      replies: [{ id: 'r', author: 'Ana', text: 'More', createdAt: local.createdAt }]
    }
    expect(cloudCommentChanges([fresh], server()).map((change) => change.kind)).toEqual([
      'create-thread',
      'reply',
      'update-thread'
    ])
    expect(cloudCommentChanges([{ ...local, deleted: true }], server(stored))).toEqual([
      { kind: 'delete-thread', threadId: THREAD }
    ])
    // A thread deleted before it reached the server needs nothing.
    expect(cloudCommentChanges([{ ...fresh, deleted: true }], server())).toEqual([])
  })

  test('send edits, replies, reply deletions, then whether it is resolved and where its pin is', () => {
    const local = documentThread(stored)
    const changed: CommentThread = {
      ...local,
      text: 'Tighten the heading more',
      x: 1,
      resolved: true,
      replies: [
        {
          ...(local.replies[0] ?? { id: REPLY, author: '', text: '', createdAt: '' }),
          deleted: true
        },
        { id: 'new-reply', author: 'Ana', text: 'Also the body', createdAt: local.createdAt }
      ]
    }
    expect(cloudCommentChanges([changed], server(stored))).toEqual([
      { kind: 'edit', threadId: THREAD, commentId: FIRST, body: 'Tighten the heading more' },
      { kind: 'delete-comment', threadId: THREAD, commentId: REPLY },
      { kind: 'reply', threadId: THREAD, reply: changed.replies[1] },
      {
        kind: 'update-thread',
        threadId: THREAD,
        input: { resolved: true, anchor: expect.objectContaining({ x: 1, y: 208, nodeId: '1:2' }) }
      }
    ])
  })

  test('bring a file’s threads in under its names, skipping deleted ones and empty times', () => {
    const local = documentThread(stored)
    const input = importedThreads(
      [
        { ...local, createdAt: '' },
        { ...local, id: 'gone', deleted: true }
      ],
      '2026-11-16T12:00:00.000Z'
    )
    expect(input.threads).toHaveLength(1)
    expect(input.threads[0]).toMatchObject({
      createdAt: '2026-11-16T12:00:00.000Z',
      comments: [
        { authorName: 'Ana', body: 'Tighten the heading' },
        { authorName: '', body: 'Done', createdAt: '2026-11-16T10:05:00.000Z' }
      ]
    })
  })

  test('cut words and names longer than the server keeps, so an import is never refused', () => {
    const local = documentThread(stored)
    const long = `${'a'.repeat(COMMENT_BODY_MAX_LENGTH - 1)}😀 tail`
    const [thread] = importedThreads(
      [{ ...local, text: long, author: 'n'.repeat(300), pageName: 'p'.repeat(300) }],
      '2026-11-16T12:00:00.000Z'
    ).threads
    const [first] = thread?.comments ?? []
    // Never through the emoji, whose first half alone would be a broken character.
    expect(first?.body).toBe('a'.repeat(COMMENT_BODY_MAX_LENGTH - 1))
    expect(first?.authorName).toHaveLength(COMMENT_NAME_MAX_LENGTH)
    expect(thread?.pageName).toHaveLength(COMMENT_NAME_MAX_LENGTH)
    expect(v.is(importCommentThreadsSchema, { threads: [thread] })).toBe(true)
  })

  test('acknowledge a change and nothing someone else did meanwhile', () => {
    const resolvedElsewhere: CloudCommentThread = {
      ...stored,
      resolvedAt: '2026-11-16T11:00:00.000Z',
      resolvedBy: 'ben',
      comments: stored.comments.map((comment) =>
        comment.id === FIRST ? { ...comment, body: 'Tighter' } : comment
      )
    }
    const edit = { kind: 'edit' as const, threadId: THREAD, commentId: FIRST, body: 'Tighter' }
    // The answer carries Ben's resolve too; only the tab's own edit is taken as sent.
    expect(acknowledged(stored, edit, resolvedElsewhere)).toEqual({
      ...stored,
      comments: resolvedElsewhere.comments
    })
    // A new thread is the server's answer; edits made while it was on its way are still to send.
    const created = acknowledged(
      undefined,
      { kind: 'create-thread', thread: documentThread(stored) },
      stored
    )
    expect(created).toEqual(stored)
    const local = { ...documentThread(stored), text: 'Edited while sending' }
    expect(cloudCommentChanges([local], new Map([[THREAD, stored]]))).toEqual([
      { kind: 'edit', threadId: THREAD, commentId: FIRST, body: 'Edited while sending' }
    ])
    expect(acknowledged(stored, { kind: 'delete-thread', threadId: THREAD }, null)).toBeNull()
  })
})
