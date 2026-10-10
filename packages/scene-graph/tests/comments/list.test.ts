import { describe, expect, test } from 'bun:test'

import {
  commentThreadNumbers,
  listCommentThreads,
  type CommentListOptions,
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

const base: CommentListOptions = {
  query: '',
  showResolved: false,
  onlyPage: false,
  pageId: '0:1',
  onlyMine: false,
  author: 'Ada',
  sort: 'newest'
}

const ids = (threads: CommentThread[]) => threads.map((entry) => entry.id)

describe('comments list', () => {
  test('hides resolved threads until asked and never lists deleted ones', () => {
    const threads = [thread('a'), thread('b', { resolved: true }), thread('c', { deleted: true })]
    expect(ids(listCommentThreads(threads, base))).toEqual(['a'])
    expect(ids(listCommentThreads(threads, { ...base, showResolved: true }))).toEqual(['a', 'b'])
  })

  test('searches text, authors and replies', () => {
    const threads = [
      thread('a', { text: 'Bigger button' }),
      thread('b', {
        replies: [{ id: 'r', author: 'Claude', text: 'Moved the logo', createdAt: '' }]
      })
    ]
    expect(ids(listCommentThreads(threads, { ...base, query: 'button' }))).toEqual(['a'])
    expect(ids(listCommentThreads(threads, { ...base, query: 'LOGO' }))).toEqual(['b'])
  })

  test('filters to this page and to threads I started or replied to', () => {
    const threads = [
      thread('mine'),
      thread('replied', {
        author: 'Claude',
        replies: [{ id: 'r', author: 'Ada', text: 'Done', createdAt: '' }]
      }),
      thread('theirs', { pageId: '0:2', author: 'Claude' })
    ]
    expect(ids(listCommentThreads(threads, { ...base, onlyPage: true }))).toEqual(['mine', 'replied'])
    expect(ids(listCommentThreads(threads, { ...base, onlyMine: true }))).toEqual(['mine', 'replied'])
  })

  test('sorts by when each thread was started', () => {
    const threads = [
      thread('old', {
        createdAt: '2026-10-07T10:00:00.000Z',
        updatedAt: '2026-10-09T10:00:00.000Z'
      }),
      thread('new', { createdAt: '2026-10-08T12:00:00.000Z' })
    ]
    expect(ids(listCommentThreads(threads, base))).toEqual(['new', 'old'])
    expect(ids(listCommentThreads(threads, { ...base, sort: 'oldest' }))).toEqual(['old', 'new'])
  })

  test('numbers threads in the order they were started, deleted ones included', () => {
    const threads = [
      thread('second', { createdAt: '2026-10-08T11:00:00.000Z' }),
      thread('first', { createdAt: '2026-10-08T10:00:00.000Z', deleted: true }),
      thread('third', { createdAt: '2026-10-08T12:00:00.000Z' })
    ]
    expect([...commentThreadNumbers(threads)]).toEqual([
      ['first', 1],
      ['second', 2],
      ['third', 3]
    ])
  })
})
