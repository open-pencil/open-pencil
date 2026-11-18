import { afterEach, describe, expect, test } from 'bun:test'

import { grantByInvitation, seedSharing } from '#cloud-tests/helpers/sharing'
import { MAX_COMMENTS_PER_THREAD, type CreateCommentThreadInput } from '#cloud/contract'
import {
  CommentConflictError,
  CommentLimitError,
  createCommentService,
  DocumentForbiddenError,
  DocumentNotFoundError
} from '#cloud/server'

const opened: { close(): Promise<void> }[] = []
afterEach(async () => {
  for (const runtime of opened.splice(0)) await runtime.close()
})
const pin: CreateCommentThreadInput = {
  pageId: '0:1',
  pageName: 'Page 1',
  nodeId: '1:2',
  nodeName: 'Hero',
  offsetX: 4,
  offsetY: 8,
  x: 104,
  y: 208,
  body: 'Tighten the heading',
  mentions: []
}

async function seedComments() {
  const context = await seedSharing()
  opened.push(context.runtime)
  const announced: { documentId: string; threadId: string }[] = []
  const comments = createCommentService(context.runtime.database, {
    sharing: context.sharing,
    onCommentsChanged: (documentId, threadId) => announced.push({ documentId, threadId })
  })
  await grantByInvitation(context, { userId: 'editor', email: 'editor@example.com' }, 'edit')
  const as = (userId: string) => comments.forMember(userId, context.documentId)
  return { ...context, comments, announced, as }
}

describe('comment service', () => {
  test('lets everyone who can read comment, as their own account', async () => {
    const { comments, as, announced, documentId } = await seedComments()
    const viewer = await as('viewer')
    expect(viewer).toMatchObject({ canComment: true, canModerate: false })
    expect(await as('editor')).toMatchObject({ canComment: true, canModerate: true })

    const thread = await comments.createThread(viewer, { ...pin, agent: 'Claude' })
    expect(thread).toMatchObject({ pageId: '0:1', nodeId: '1:2', x: 104, resolvedAt: null })
    expect(thread.comments).toEqual([
      expect.objectContaining({
        author: { kind: 'user', id: 'viewer', name: null },
        agent: 'Claude',
        body: 'Tighten the heading',
        editedAt: null
      })
    ])
    const replied = await comments.reply(await as('owner'), thread.id, { body: 'Done' })
    expect(replied.comments.map((comment) => comment.body)).toEqual(['Tighten the heading', 'Done'])
    expect((await comments.list(viewer)).threads.map((listed) => listed.id)).toEqual([thread.id])
    expect(announced).toEqual([
      { documentId, threadId: thread.id },
      { documentId, threadId: thread.id }
    ])

    await expect(as('stranger')).rejects.toThrow(DocumentNotFoundError)
  })

  test('changes a comment only for its author, and deletes it for its author or an editor', async () => {
    const { comments, as } = await seedComments()
    const viewer = await as('viewer')
    const owner = await as('owner')
    const thread = await comments.createThread(owner, pin)
    const withReply = await comments.reply(viewer, thread.id, { body: 'Agreed' })
    const reply = withReply.comments[1]
    if (!reply) throw new Error('The reply is missing')

    // Not even an editor puts words in someone else's mouth.
    await expect(
      comments.updateComment(owner, thread.id, reply.id, { body: 'Disagreed' })
    ).rejects.toThrow(DocumentForbiddenError)
    const edited = await comments.updateComment(viewer, thread.id, reply.id, { body: 'Agreed!' })
    expect(edited.comments[1]).toMatchObject({ body: 'Agreed!', editedAt: expect.any(String) })

    const first = thread.comments[0]
    if (!first) throw new Error('The first comment is missing')
    await expect(comments.deleteComment(viewer, thread.id, first.id)).rejects.toThrow(
      DocumentForbiddenError
    )
    const remaining = await comments.deleteComment(await as('editor'), thread.id, reply.id)
    expect(remaining?.comments.map((comment) => comment.id)).toEqual([first.id])

    // Deleted for good: nothing of it is left to export or restore.
    expect(await comments.deleteComment(owner, thread.id, first.id)).toBeNull()
    expect((await comments.list(owner)).threads).toEqual([])
  })

  test('resolves for anyone commenting, and moves a pin only for its starter or an editor', async () => {
    const { comments, as } = await seedComments()
    const viewer = await as('viewer')
    const thread = await comments.createThread(await as('owner'), pin)

    const resolved = await comments.updateThread(viewer, thread.id, { resolved: true })
    expect(resolved).toMatchObject({ resolvedBy: 'viewer', resolvedAt: expect.any(String) })
    const reopened = await comments.updateThread(viewer, thread.id, { resolved: false })
    expect(reopened).toMatchObject({ resolvedBy: null, resolvedAt: null })

    const anchor = { ...pin, nodeId: null, nodeName: null, offsetX: null, offsetY: null, x: 1 }
    await expect(comments.updateThread(viewer, thread.id, { anchor })).rejects.toThrow(
      DocumentForbiddenError
    )
    await expect(comments.deleteThread(viewer, thread.id)).rejects.toThrow(DocumentForbiddenError)
    const moved = await comments.updateThread(await as('editor'), thread.id, { anchor })
    expect(moved).toMatchObject({ nodeId: null, x: 1, y: 208 })
  })

  test('lets guests on a link read, and people signed in comment', async () => {
    const { comments, sharing, as, documentId } = await seedComments()
    await comments.createThread(await as('owner'), pin)
    const link = await sharing.createShare('owner', documentId, { permission: 'view' })
    const shareId = link.share.id

    const guest = await comments.forShare(shareId, link.secret, undefined)
    expect(guest).toMatchObject({ documentId, userId: null, canComment: false })
    expect((await comments.list(guest)).threads).toHaveLength(1)
    await expect(comments.createThread(guest, pin)).rejects.toThrow(DocumentForbiddenError)

    const visitor = await comments.forShare(shareId, link.secret, {
      userId: 'visitor',
      name: 'Visitor',
      email: 'visitor@example.com'
    })
    expect(visitor).toMatchObject({ userId: 'visitor', canComment: true, canModerate: false })
    const thread = await comments.createThread(visitor, pin)
    expect(thread.comments[0]?.author).toEqual({ kind: 'user', id: 'visitor', name: null })

    await expect(comments.forShare(shareId, 'x'.repeat(64), undefined)).rejects.toThrow()
  })

  test('keeps a thread to its document and to its most comments', async () => {
    const { comments, as, runtime } = await seedComments()
    const owner = await as('owner')
    const thread = await comments.createThread(owner, pin)
    await expect(comments.get(owner, crypto.randomUUID())).rejects.toThrow(DocumentNotFoundError)

    await runtime.database
      .insertInto('comment')
      .values(
        Array.from({ length: MAX_COMMENTS_PER_THREAD - 1 }, () => ({
          id: crypto.randomUUID(),
          threadId: thread.id,
          authorId: 'owner',
          body: 'More'
        }))
      )
      .execute()
    await expect(comments.reply(owner, thread.id, { body: 'One too many' })).rejects.toThrow(
      CommentLimitError
    )
  })

  test('goes with its document', async () => {
    const { comments, as, runtime, documentId } = await seedComments()
    await comments.createThread(await as('owner'), pin)
    await runtime.database.deleteFrom('document').where('id', '=', documentId).execute()
    expect(await runtime.database.selectFrom('comment').select('id').execute()).toEqual([])
  })

  test('takes the ID the editor chose, and finds it again when a request is sent twice', async () => {
    const { comments, as } = await seedComments()
    const viewer = await as('viewer')
    const id = crypto.randomUUID()
    const thread = await comments.createThread(viewer, { ...pin, id })
    expect(thread.id).toBe(id)
    expect(await comments.createThread(viewer, { ...pin, id, body: 'Sent again' })).toEqual(thread)
    await expect(comments.createThread(await as('owner'), { ...pin, id })).rejects.toThrow(
      CommentConflictError
    )

    const replyId = crypto.randomUUID()
    const replied = await comments.reply(viewer, id, { id: replyId, body: 'Also' })
    expect(replied.comments[1]?.id).toBe(replyId)
    expect((await comments.reply(viewer, id, { id: replyId, body: 'Also' })).comments).toHaveLength(
      2
    )
  })

  test('brings in a file’s threads under the names it gave, for editors only', async () => {
    const { comments, as } = await seedComments()
    const imported = {
      threads: [
        {
          ...pin,
          createdAt: '2026-10-01T09:00:00.000Z',
          resolved: true,
          comments: [
            { authorName: 'Ana', body: 'Too tight', createdAt: '2026-10-01T09:00:00.000Z' },
            { authorName: 'Ben', body: 'Fixed', createdAt: '2026-10-02T09:00:00.000Z' }
          ]
        }
      ]
    }
    await expect(comments.importThreads(await as('viewer'), imported)).rejects.toThrow(
      DocumentForbiddenError
    )
    const { threads } = await comments.importThreads(await as('editor'), imported)
    expect(threads).toHaveLength(1)
    expect(threads[0]).toMatchObject({
      createdAt: '2026-10-01T09:00:00.000Z',
      resolvedBy: 'editor',
      comments: [
        { author: { kind: 'imported', name: 'Ana' }, body: 'Too tight' },
        { author: { kind: 'imported', name: 'Ben' }, createdAt: '2026-10-02T09:00:00.000Z' }
      ]
    })
  })

  test('change nothing when a thread already is as asked', async () => {
    const { comments, as } = await seedComments()
    const viewer = await as('viewer')
    const thread = await comments.createThread(viewer, pin)
    await comments.updateThread(viewer, thread.id, { resolved: true })
    const again = await comments.updateThread(viewer, thread.id, { resolved: true })
    expect(again.resolvedBy).toBe('viewer')
  })

  test('keep a file’s first comment first, whatever times it gave', async () => {
    const { comments, as, announced } = await seedComments()
    const at = '2026-10-01T09:00:00.000Z'
    const { threads } = await comments.importThreads(await as('editor'), {
      threads: [
        {
          ...pin,
          createdAt: at,
          resolved: false,
          comments: [
            { authorName: 'Ana', body: 'First', createdAt: at },
            { authorName: 'Ben', body: 'Same moment', createdAt: at }
          ]
        }
      ]
    })
    const [thread] = threads
    if (!thread) throw new Error('The thread did not come in')
    expect(thread.comments.map((comment) => comment.body)).toEqual(['First', 'Same moment'])
    // Open rooms hear of what came in, as of any other change.
    expect(announced.map((change) => change.threadId)).toEqual([thread.id])
    const reply = thread.comments[1]?.id ?? ''
    expect(await comments.deleteComment(await as('editor'), thread.id, reply)).not.toBeNull()
  })
})
