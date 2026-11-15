import {
  MAX_COMMENT_THREADS_PER_DOCUMENT,
  MAX_COMMENTS_PER_THREAD,
  type CloudCommentThread,
  type CommentAccess,
  type CommentThreads,
  type CreateCommentInput,
  type CreateCommentThreadInput,
  type ImportCommentThreadsInput,
  type NotificationSettings,
  type UpdateCommentInput,
  type UpdateCommentThreadInput
} from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import { resolveDocumentCommentAccess } from '#cloud/server/documents/access'
import { DocumentForbiddenError, DocumentNotFoundError } from '#cloud/server/documents/errors'
import { logCloud, loggedError } from '#cloud/server/logging'
import type { DocumentSharingService } from '#cloud/server/sharing'
import { chunk, groupBy } from 'es-toolkit'
import type { Kysely, Transaction } from 'kysely'

import {
  commentPeople,
  notifyComment,
  recordMentions,
  readNotificationSettings,
  threadParticipants,
  writeNotificationSettings,
  type CommentNotifier
} from './notify'
import {
  anchorValues,
  comments,
  documentThreadCount,
  findThread,
  lockDocument,
  markRead,
  readsOf,
  resolutionChange,
  threadOf,
  threads,
  type ThreadRow,
  type Source
} from './rows'

/** A document holds as many threads, or a thread as many comments, as it may. */
export class CommentLimitError extends Error {
  override readonly name = 'CommentLimitError'
}

/** A new thread or comment named an ID something else already has. */
export class CommentConflictError extends Error {
  override readonly name = 'CommentConflictError'
}

/**
 * Whose request it is and what they may do, settled before any comment is touched: a member or
 * grantee through `forMember`, or whoever follows a share link through `forShare`.
 */
export type CommentActor = CommentAccess & {
  documentId: string
  /** Null for a guest on a link, who may only read. */
  userId: string | null
}

/** A request's input as callers may write it: naming nobody when it lists no mentions. */
type Mentioning<Input extends { mentions: string[] }> = Omit<Input, 'mentions'> & {
  mentions?: readonly string[]
}
type NewThread = Mentioning<CreateCommentThreadInput>
type NewComment = Mentioning<CreateCommentInput>
type CommentEdit = Mentioning<UpdateCommentInput>

/** Rows one insert writes, within PostgreSQL's parameters per statement. */
const INSERT_BATCH = 500

function requireCommenter(actor: CommentActor): string {
  if (!actor.canComment || actor.userId === null) throw new DocumentForbiddenError()
  return actor.userId
}

/**
 * The comments of Cloud documents. Everyone who can read a document reads its comments; everyone
 * signed in who can read writes them. A comment is changed only by its author, and deleted by its
 * author or an editor; a thread's pin is moved by whoever started it or an editor, and anyone who
 * comments resolves or reopens it. Deleting a thread's first comment deletes the thread.
 */
export function createCommentService(
  database: Kysely<CloudDatabase>,
  options: {
    sharing?: Pick<DocumentSharingService, 'resolveShare'>
    /** Called once a thread changes, so the document's live rooms fetch it again. */
    onCommentsChanged?: (documentId: string, threadId: string) => void
    /** Emails the people a comment concerns; without it nobody hears by email. */
    notifier?: CommentNotifier
  } = {}
) {
  /**
   * Records whom a comment names and emails them, and, for a reply, the thread's other writers
   * who asked to hear about everything.
   */
  async function tell(
    transaction: Transaction<CloudDatabase>,
    actor: CommentActor,
    comment: { commentId: string; threadId: string; body: string },
    mentions: readonly string[],
    { reply = false } = {}
  ) {
    const authorId = requireCommenter(actor)
    const mentioned = await recordMentions(transaction, {
      documentId: actor.documentId,
      commentId: comment.commentId,
      authorId,
      mentions
    })
    if (!options.notifier) return
    const participants = reply
      ? await threadParticipants(transaction, actor.documentId, comment.threadId, authorId)
      : []
    await notifyComment(transaction, options.notifier, {
      id: comment.commentId,
      documentId: actor.documentId,
      threadId: comment.threadId,
      authorId,
      body: comment.body,
      mentioned,
      participants
    })
  }

  function announce(documentId: string, threadId: string): void {
    try {
      options.onCommentsChanged?.(documentId, threadId)
    } catch (error) {
      logCloud('error', 'Announcing a comment change failed', { error: loggedError(error) })
    }
  }

  async function readThread(
    source: Source,
    row: ThreadRow,
    viewer: string | null
  ): Promise<CloudCommentThread> {
    const reads = await readsOf(source, viewer, [row.id])
    return threadOf(row, await comments(source, [row.id]), viewer, reads.get(row.id))
  }

  /**
   * Marks the thread changed now, and read by whoever changed it, and answers it as it is after
   * the change.
   */
  async function touched(
    transaction: Transaction<CloudDatabase>,
    actor: CommentActor,
    threadId: string
  ): Promise<CloudCommentThread> {
    await transaction
      .updateTable('commentThread')
      .set({ updatedAt: new Date() })
      .where('id', '=', threadId)
      .execute()
    if (actor.userId !== null) await markRead(transaction, actor.userId, threadId)
    return readThread(
      transaction,
      await findThread(transaction, actor.documentId, threadId),
      actor.userId
    )
  }

  async function findComment(
    source: Source,
    threadId: string,
    commentId: string
  ): Promise<{ authorId: string | null; first: boolean }> {
    const rows = await source
      .selectFrom('comment')
      .select(['id', 'authorId'])
      .where('threadId', '=', threadId)
      .orderBy('createdAt')
      .orderBy('id')
      .execute()
    const index = rows.findIndex((comment) => comment.id === commentId)
    const found = rows[index]
    if (!found) throw new DocumentNotFoundError()
    return { authorId: found.authorId, first: index === 0 }
  }

  /** A comment of a thread, with the thread held until the transaction ends. */
  async function lockedComment(
    transaction: Transaction<CloudDatabase>,
    actor: CommentActor,
    threadId: string,
    commentId: string
  ) {
    await findThread(transaction, actor.documentId, threadId, true)
    return findComment(transaction, threadId, commentId)
  }

  /** Every thread on the document, oldest first, with what the asker may do. */
  async function list(actor: CommentActor): Promise<CommentThreads> {
    const rows = await threads(database)
      .where('commentThread.documentId', '=', actor.documentId)
      .orderBy('commentThread.createdAt')
      .orderBy('commentThread.id')
      .execute()
    const ids = rows.map((row) => row.id)
    const byThread =
      rows.length > 0 ? groupBy(await comments(database, ids), (c) => c.threadId) : {}
    const reads = await readsOf(database, actor.userId, ids)
    return {
      threads: rows.map((row) =>
        threadOf(row, byThread[row.id] ?? [], actor.userId, reads.get(row.id))
      ),
      access: { canComment: actor.canComment, canModerate: actor.canModerate }
    }
  }

  return {
    /** A member's or grantee's access to a document's comments. */
    async forMember(userId: string, documentId: string): Promise<CommentActor> {
      const access = await resolveDocumentCommentAccess(database, userId, documentId)
      if (!access) throw new DocumentNotFoundError()
      return { ...access, documentId, userId }
    },

    /**
     * Access through a share link: everyone with it reads; people signed in also comment, and
     * moderate when the link lets them edit. A guest on any link only reads.
     */
    async forShare(
      shareId: string,
      secret: string,
      actor: { userId: string; name: string; email: string } | undefined
    ): Promise<CommentActor> {
      if (!options.sharing) throw new DocumentNotFoundError()
      const resolution = await options.sharing.resolveShare(shareId, { secret }, actor)
      const userId = resolution.principal.kind === 'user' ? resolution.principal.userId : null
      return {
        documentId: resolution.documentId,
        userId,
        canComment: userId !== null,
        canModerate: userId !== null && resolution.permission === 'edit'
      }
    },

    list,

    async get(actor: CommentActor, threadId: string): Promise<CloudCommentThread> {
      return readThread(
        database,
        await findThread(database, actor.documentId, threadId),
        actor.userId
      )
    },

    /** Records that the asker read the thread as it is now; a guest keeps no such record. */
    async markRead(actor: CommentActor, threadId: string): Promise<void> {
      if (actor.userId === null) return
      await findThread(database, actor.documentId, threadId)
      await markRead(database, actor.userId, threadId)
    },

    /** Which comments the account hears about by email. */
    notificationSettings: (userId: string) => readNotificationSettings(database, userId),
    setNotificationSettings: (userId: string, settings: NotificationSettings) =>
      writeNotificationSettings(database, userId, settings),

    /** Whom the asker may name in the document's comments. */
    async people(actor: CommentActor) {
      requireCommenter(actor)
      return { people: await commentPeople(database, actor.documentId) }
    },

    async createThread(actor: CommentActor, input: NewThread): Promise<CloudCommentThread> {
      const userId = requireCommenter(actor)
      const threadId = input.id ?? crypto.randomUUID()
      const thread = await database.transaction().execute(async (transaction) => {
        // One writer at a time per document, so the count below holds until the insert.
        await lockDocument(transaction, actor.documentId)
        const existing = await transaction
          .selectFrom('commentThread')
          .select(['documentId', 'createdBy'])
          .where('id', '=', threadId)
          .executeTakeFirst()
        if (existing) {
          // The same request again, its answer lost on the way: the thread it made.
          if (existing.documentId !== actor.documentId || existing.createdBy !== userId) {
            throw new CommentConflictError()
          }
          return readThread(
            transaction,
            await findThread(transaction, actor.documentId, threadId),
            actor.userId
          )
        }
        if (
          (await documentThreadCount(transaction, actor.documentId)) >=
          MAX_COMMENT_THREADS_PER_DOCUMENT
        ) {
          throw new CommentLimitError()
        }
        const now = new Date()
        await transaction
          .insertInto('commentThread')
          .values({
            id: threadId,
            documentId: actor.documentId,
            ...anchorValues(input),
            createdBy: userId,
            createdAt: now,
            updatedAt: now
          })
          .execute()
        const commentId = crypto.randomUUID()
        await transaction
          .insertInto('comment')
          .values({
            id: commentId,
            threadId,
            authorId: userId,
            agent: input.agent ?? null,
            body: input.body,
            createdAt: now
          })
          .execute()
        await markRead(transaction, userId, threadId)
        await tell(
          transaction,
          actor,
          { commentId, threadId, body: input.body },
          input.mentions ?? []
        )
        return readThread(
          transaction,
          await findThread(transaction, actor.documentId, threadId),
          actor.userId
        )
      })
      announce(actor.documentId, threadId)
      return thread
    },

    /**
     * Brings in the threads a file held as it moved to Cloud, for someone who may edit it. Their
     * authors stay the names the file gave; the importer may move and resolve them as a starter.
     */
    async importThreads(
      actor: CommentActor,
      input: ImportCommentThreadsInput
    ): Promise<CommentThreads> {
      const userId = requireCommenter(actor)
      if (!actor.canModerate) throw new DocumentForbiddenError()
      if (input.threads.length > 0) {
        await database.transaction().execute(async (transaction) => {
          await lockDocument(transaction, actor.documentId)
          const held = await documentThreadCount(transaction, actor.documentId)
          if (held + input.threads.length > MAX_COMMENT_THREADS_PER_DOCUMENT) {
            throw new CommentLimitError()
          }
          const now = new Date()
          const rows = input.threads.map((thread) => ({
            thread,
            id: crypto.randomUUID(),
            createdAt: new Date(thread.createdAt)
          }))
          const threadRows = rows.map(({ thread, id, createdAt }) => ({
            id,
            documentId: actor.documentId,
            ...anchorValues(thread),
            createdBy: userId,
            createdAt,
            updatedAt: now,
            resolvedAt: thread.resolved ? now : null,
            resolvedBy: thread.resolved ? userId : null
          }))
          for (const batch of chunk(threadRows, INSERT_BATCH)) {
            await transaction.insertInto('commentThread').values(batch).execute()
          }
          const imported = rows.flatMap(({ thread, id }) =>
            thread.comments.map((comment) => ({
              id: crypto.randomUUID(),
              threadId: id,
              authorId: null,
              importedAuthorName: comment.authorName,
              body: comment.body,
              createdAt: new Date(comment.createdAt)
            }))
          )
          // A statement takes so many parameters; a big file's comments go in a few.
          for (const batch of chunk(imported, INSERT_BATCH)) {
            await transaction.insertInto('comment').values(batch).execute()
          }
        })
      }
      return list(actor)
    },

    async updateThread(
      actor: CommentActor,
      threadId: string,
      input: UpdateCommentThreadInput
    ): Promise<CloudCommentThread> {
      const userId = requireCommenter(actor)
      const thread = await database.transaction().execute(async (transaction) => {
        const row = await findThread(transaction, actor.documentId, threadId, true)
        if (input.anchor && row.createdBy !== userId && !actor.canModerate) {
          throw new DocumentForbiddenError()
        }
        const resolution = resolutionChange(input.resolved, row.resolvedAt !== null, userId)
        await transaction
          .updateTable('commentThread')
          .set({ ...(input.anchor ? anchorValues(input.anchor) : {}), ...resolution })
          .where('id', '=', threadId)
          .execute()
        return touched(transaction, actor, threadId)
      })
      announce(actor.documentId, threadId)
      return thread
    },

    async deleteThread(actor: CommentActor, threadId: string): Promise<void> {
      const userId = requireCommenter(actor)
      await database.transaction().execute(async (transaction) => {
        const row = await findThread(transaction, actor.documentId, threadId, true)
        if (row.createdBy !== userId && !actor.canModerate) throw new DocumentForbiddenError()
        await transaction.deleteFrom('commentThread').where('id', '=', threadId).execute()
      })
      announce(actor.documentId, threadId)
    },

    async reply(
      actor: CommentActor,
      threadId: string,
      input: NewComment
    ): Promise<CloudCommentThread> {
      const userId = requireCommenter(actor)
      const commentId = input.id ?? crypto.randomUUID()
      const thread = await database.transaction().execute(async (transaction) => {
        await findThread(transaction, actor.documentId, threadId, true)
        const existing = await transaction
          .selectFrom('comment')
          .select(['threadId', 'authorId'])
          .where('id', '=', commentId)
          .executeTakeFirst()
        if (existing) {
          if (existing.threadId !== threadId || existing.authorId !== userId) {
            throw new CommentConflictError()
          }
          return readThread(
            transaction,
            await findThread(transaction, actor.documentId, threadId),
            actor.userId
          )
        }
        const { count } = await transaction
          .selectFrom('comment')
          .select((expression) => expression.fn.countAll<string>().as('count'))
          .where('threadId', '=', threadId)
          .executeTakeFirstOrThrow()
        if (Number(count) >= MAX_COMMENTS_PER_THREAD) throw new CommentLimitError()
        await transaction
          .insertInto('comment')
          .values({
            id: commentId,
            threadId,
            authorId: userId,
            agent: input.agent ?? null,
            body: input.body
          })
          .execute()
        await tell(
          transaction,
          actor,
          { commentId, threadId, body: input.body },
          input.mentions ?? [],
          {
            reply: true
          }
        )
        return touched(transaction, actor, threadId)
      })
      announce(actor.documentId, threadId)
      return thread
    },

    /** Changes what a comment says; only its author may, so no one puts words in another's mouth. */
    async updateComment(
      actor: CommentActor,
      threadId: string,
      commentId: string,
      input: CommentEdit
    ): Promise<CloudCommentThread> {
      const userId = requireCommenter(actor)
      const thread = await database.transaction().execute(async (transaction) => {
        const comment = await lockedComment(transaction, actor, threadId, commentId)
        if (comment.authorId !== userId) throw new DocumentForbiddenError()
        await transaction
          .updateTable('comment')
          .set({ body: input.body, editedAt: new Date() })
          .where('id', '=', commentId)
          .execute()
        // An edit tells only the people it names that it did not before.
        await tell(
          transaction,
          actor,
          { commentId, threadId, body: input.body },
          input.mentions ?? []
        )
        return touched(transaction, actor, threadId)
      })
      announce(actor.documentId, threadId)
      return thread
    },

    /** Deletes a comment for good; the thread goes with its first one. Null once it is gone. */
    async deleteComment(
      actor: CommentActor,
      threadId: string,
      commentId: string
    ): Promise<CloudCommentThread | null> {
      const userId = requireCommenter(actor)
      const thread = await database.transaction().execute(async (transaction) => {
        const comment = await lockedComment(transaction, actor, threadId, commentId)
        if (comment.authorId !== userId && !actor.canModerate) throw new DocumentForbiddenError()
        if (comment.first) {
          await transaction.deleteFrom('commentThread').where('id', '=', threadId).execute()
          return null
        }
        await transaction.deleteFrom('comment').where('id', '=', commentId).execute()
        return touched(transaction, actor, threadId)
      })
      announce(actor.documentId, threadId)
      return thread
    }
  }
}

export type CommentService = ReturnType<typeof createCommentService>
