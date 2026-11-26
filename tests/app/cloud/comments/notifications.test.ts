import { describe, expect, test } from 'bun:test'

import type { CloudComment, CloudCommentThread } from '@open-pencil/cloud/contract'

import { commentNotice } from '@/app/cloud/comments/notifications'

import { COMMENT_TIME as NOW } from '#tests/helpers/cloud/comments'

const ME = 'ana'

function comment(
  id: string,
  by: string,
  mentions: string[] = [],
  author?: CloudComment['author']
): CloudComment {
  return {
    id: `00000000-0000-4000-8000-00000000000${id}`,
    author: author ?? { kind: 'user', id: by, name: by },
    agent: null,
    body: `**${by}** says ${id}`,
    mentions,
    createdAt: NOW,
    editedAt: null
  }
}

function thread(...comments: CloudComment[]): CloudCommentThread {
  return {
    id: '00000000-0000-4000-8000-000000000100',
    pageId: '0:1',
    pageName: null,
    nodeId: null,
    nodeName: null,
    offsetX: null,
    offsetY: null,
    x: 0,
    y: 0,
    createdAt: NOW,
    updatedAt: NOW,
    resolvedAt: null,
    resolvedBy: null,
    createdBy: comments[0]?.author.kind === 'user' ? comments[0].author.id : 'ben',
    unread: true,
    comments
  }
}

const notice = (
  before: CloudCommentThread | undefined,
  after: CloudCommentThread | null,
  accountId: string | null = ME
) => {
  const heard = new Set(before?.comments.map((entry) => entry.id))
  const found = commentNotice(after, accountId, heard)
  return found && [found.event, found.comment.id.at(-1)]
}

describe('Cloud comment notifications', () => {
  test('tell about a new thread that names the person, and not one that does not', () => {
    expect(notice(undefined, thread(comment('1', 'ben', [ME])))).toEqual(['commentMention', '1'])
    expect(notice(undefined, thread(comment('1', 'ben')))).toBeNull()
  })

  test('tell about a reply in a thread the person wrote in', () => {
    const before = thread(comment('1', 'ana'))
    expect(notice(before, thread(...before.comments, comment('2', 'ben')))).toEqual([
      'commentReply',
      '2'
    ])
  })

  test('leave out replies in threads the person never wrote in', () => {
    const before = thread(comment('1', 'ben'))
    expect(notice(before, thread(...before.comments, comment('2', 'cy')))).toBeNull()
  })

  test('prefer a mention to a later reply, and tell about the latest reply', () => {
    const before = thread(comment('1', 'ana'))
    const mentioned = thread(...before.comments, comment('2', 'ben', [ME]), comment('3', 'cy'))
    expect(notice(before, mentioned)).toEqual(['commentMention', '2'])
    const replies = thread(...before.comments, comment('2', 'ben'), comment('3', 'cy'))
    expect(notice(before, replies)).toEqual(['commentReply', '3'])
  })

  test('add nothing for the person’s own comments, edits, imports, deletions, or a guest', () => {
    const before = thread(comment('1', 'ana'), comment('2', 'ben'))
    expect(notice(before, thread(...before.comments, comment('3', 'ana', [ME])))).toBeNull()
    const edited = thread(comment('1', 'ana'), comment('2', 'ben', [ME]))
    expect(notice(before, edited)).toBeNull()
    const imported = comment('3', 'ben', [ME], { kind: 'imported', name: 'Ben' })
    expect(notice(before, thread(...before.comments, imported))).toBeNull()
    expect(notice(before, null)).toBeNull()
    expect(notice(before, thread(...before.comments, comment('3', 'ben', [ME])), null)).toBeNull()
  })
})
