import { expect, test } from 'bun:test'

import {
  hasNewerComments,
  mergeCommentThreads,
  type CommentThread
} from '@open-pencil/scene-graph'


function thread(id: string, patch: Partial<CommentThread> = {}): CommentThread {
  return {
    id,
    pageId: '0:1',
    x: 0,
    y: 0,
    author: 'Ada',
    text: id,
    createdAt: '2026-10-08T10:00:00.000Z',
    updatedAt: '2026-10-08T10:00:00.000Z',
    resolved: false,
    replies: [],
    ...patch
  }
}

const reply = (id: string, deleted?: boolean) => ({
  id,
  author: 'Ada',
  text: id,
  createdAt: `2026-10-08T10:0${id.length}:00.000Z`,
  deleted
})

test('keeps threads from both copies and the newer edit of a shared one', () => {
  const later = '2026-10-08T11:00:00.000Z'
  const merged = mergeCommentThreads(
    [thread('a', { resolved: true, updatedAt: later }), thread('mine')],
    [thread('a'), thread('theirs')]
  )
  expect(merged.map((entry) => entry.id).toSorted()).toEqual(['a', 'mine', 'theirs'])
  expect(merged.find((entry) => entry.id === 'a')?.resolved).toBe(true)
})

test('joins replies and never brings a deleted thread or reply back', () => {
  const [merged] = mergeCommentThreads(
    [thread('a', { deleted: true, replies: [reply('r'), reply('mine')] })],
    [thread('a', { updatedAt: '2026-10-09T00:00:00.000Z', replies: [reply('r', true)] })]
  )
  expect(merged?.deleted).toBe(true)
  expect(merged?.replies.map((entry) => [entry.id, !!entry.deleted])).toEqual([
    ['r', true],
    ['mine', false]
  ])
})

test('knows when a copy already holds everything another has', () => {
  const local = [thread('a', { replies: [reply('r')] })]
  expect(hasNewerComments(local, mergeCommentThreads(local, [thread('b')]))).toBe(false)
  expect(hasNewerComments(local, [thread('a')])).toBe(true)
  expect(hasNewerComments([thread('a', { deleted: true })], [thread('a')])).toBe(true)
})
