import {
  MAX_COMMENT_THREADS_PER_DOCUMENT,
  MAX_COMMENTS_PER_THREAD,
  type CloudComment,
  type CloudCommentThread,
  type CommentAccess,
  type CommentAnchor,
  type CommentThreads,
  type CreateCommentInput,
  type CreateCommentThreadInput,
  type UpdateCommentInput,
  type UpdateCommentThreadInput
} from '#cloud/contract'
import { userIdText, type CloudDatabase } from '#cloud/server/db'
import { resolveDocumentCommentAccess } from '#cloud/server/documents/access'
import { DocumentForbiddenError, DocumentNotFoundError } from '#cloud/server/documents/errors'
import { logCloud, loggedError } from '#cloud/server/logging'
import type { DocumentSharingService } from '#cloud/server/sharing'
import { groupBy } from 'es-toolkit'
import type { Kysely, Transaction } from 'kysely'

/** A document holds as many threads, or a thread as many comments, as it may. */
export class CommentLimitError extends Error {
  override readonly name = 'CommentLimitError'
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

type Source = Kysely<CloudDatabase> | Transaction<CloudDatabase>

type ThreadRow = {
  id: string
  pageId: string
  pageName: string | null
  nodeId: string | null
  nodeName: string | null
  offsetX: number | null
  offsetY: number | null
  x: number
  y: number
  createdBy: string
  createdAt: Date
  updatedAt: Date
  resolvedAt: Date | null
  resolvedBy: string | null
}

type CommentRow = {
  id: string
  threadId: string
  authorId: string | null
  authorName: string | null
  importedAuthorName: string | null
  agent: string | null
  body: string
  createdAt: Date
  editedAt: Date | null
}

function commentOf(row: CommentRow): CloudComment {
  return {
    id: row.id,
    author:
      row.authorId === null
        ? { kind: 'imported', name: row.importedAuthorName ?? '' }
        : { kind: 'user', id: row.authorId, name: row.authorName },
    agent: row.agent,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null
  }
}

function threadOf(row: ThreadRow, comments: readonly CommentRow[]): CloudCommentThread {
  return {
    id: row.id,
    pageId: row.pageId,
    pageName: row.pageName,
    nodeId: row.nodeId,
    nodeName: row.nodeName,
    offsetX: row.offsetX,
    offsetY: row.offsetY,
    x: row.x,
    y: row.y,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolvedBy: row.resolvedBy,
    comments: comments.map(commentOf)
  }
}

function anchorValues(anchor: CommentAnchor) {
  return {
    pageId: anchor.pageId,
    pageName: anchor.pageName,
    nodeId: anchor.nodeId,
    nodeName: anchor.nodeName,
    offsetX: anchor.offsetX,
    offsetY: anchor.offsetY,
    x: anchor.x,
    y: anchor.y
  }
}

/** What resolving or reopening sets, or nothing when the thread already is as asked. */
function resolutionChange(resolved: boolean | undefined, isResolved: boolean, userId: string) {
  if (resolved === undefined || resolved === isResolved) return {}
  return resolved
    ? { resolvedAt: new Date(), resolvedBy: userId }
    : { resolvedAt: null, resolvedBy: null }
}

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
  } = {}
) {
  function announce(documentId: string, threadId: string): void {
    try {
      options.onCommentsChanged?.(documentId, threadId)
    } catch (error) {
      logCloud('error', 'Announcing a comment change failed', { error: loggedError(error) })
    }
  }

  function threads(source: Source) {
    return source
      .selectFrom('commentThread')
      .select([
        'commentThread.id',
        'commentThread.pageId',
        'commentThread.pageName',
        'commentThread.nodeId',
        'commentThread.nodeName',
        'commentThread.offsetX',
        'commentThread.offsetY',
        'commentThread.x',
        'commentThread.y',
        'commentThread.createdBy',
        'commentThread.createdAt',
        'commentThread.updatedAt',
        'commentThread.resolvedAt',
        'commentThread.resolvedBy'
      ])
  }

  function comments(source: Source, threadIds: readonly string[]) {
    return source
      .selectFrom('comment')
      .leftJoin('user', (join) => join.onRef(userIdText, '=', 'comment.authorId'))
      .select([
        'comment.id',
        'comment.threadId',
        'comment.authorId',
        'user.name as authorName',
        'comment.importedAuthorName',
        'comment.agent',
        'comment.body',
        'comment.createdAt',
        'comment.editedAt'
      ])
      .where('comment.threadId', 'in', [...threadIds])
      .orderBy('comment.createdAt')
      .orderBy('comment.id')
      .execute()
  }

  async function findThread(source: Source, documentId: string, threadId: string, lock = false) {
    let query = threads(source)
      .where('commentThread.documentId', '=', documentId)
      .where('commentThread.id', '=', threadId)
    if (lock) query = query.forUpdate()
    const row = await query.executeTakeFirst()
    if (!row) throw new DocumentNotFoundError()
    return row
  }

  async function readThread(source: Source, row: ThreadRow): Promise<CloudCommentThread> {
    return threadOf(row, await comments(source, [row.id]))
  }

  /** Marks the thread changed now, and answers it as it is after the change. */
  async function touched(
    transaction: Transaction<CloudDatabase>,
    documentId: string,
    threadId: string
  ): Promise<CloudCommentThread> {
    await transaction
      .updateTable('commentThread')
      .set({ updatedAt: new Date() })
      .where('id', '=', threadId)
      .execute()
    return readThread(transaction, await findThread(transaction, documentId, threadId))
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

    /** Every thread on the document, oldest first, with what the asker may do. */
    async list(actor: CommentActor): Promise<CommentThreads> {
      const rows = await threads(database)
        .where('commentThread.documentId', '=', actor.documentId)
        .orderBy('commentThread.createdAt')
        .orderBy('commentThread.id')
        .execute()
      const byThread =
        rows.length > 0
          ? groupBy(
              await comments(
                database,
                rows.map((row) => row.id)
              ),
              (comment) => comment.threadId
            )
          : {}
      return {
        threads: rows.map((row) => threadOf(row, byThread[row.id] ?? [])),
        access: { canComment: actor.canComment, canModerate: actor.canModerate }
      }
    },

    async get(actor: CommentActor, threadId: string): Promise<CloudCommentThread> {
      return readThread(database, await findThread(database, actor.documentId, threadId))
    },

    async createThread(
      actor: CommentActor,
      input: CreateCommentThreadInput
    ): Promise<CloudCommentThread> {
      const userId = requireCommenter(actor)
      const threadId = crypto.randomUUID()
      const thread = await database.transaction().execute(async (transaction) => {
        // One writer at a time per document, so the count below holds until the insert.
        await transaction
          .selectFrom('document')
          .select('id')
          .where('id', '=', actor.documentId)
          .forUpdate()
          .executeTakeFirstOrThrow()
        const { count } = await transaction
          .selectFrom('commentThread')
          .select((expression) => expression.fn.countAll<string>().as('count'))
          .where('documentId', '=', actor.documentId)
          .executeTakeFirstOrThrow()
        if (Number(count) >= MAX_COMMENT_THREADS_PER_DOCUMENT) throw new CommentLimitError()
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
        await transaction
          .insertInto('comment')
          .values({
            id: crypto.randomUUID(),
            threadId,
            authorId: userId,
            agent: input.agent ?? null,
            body: input.body,
            createdAt: now
          })
          .execute()
        return readThread(transaction, await findThread(transaction, actor.documentId, threadId))
      })
      announce(actor.documentId, threadId)
      return thread
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
        return touched(transaction, actor.documentId, threadId)
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
      input: CreateCommentInput
    ): Promise<CloudCommentThread> {
      const userId = requireCommenter(actor)
      const thread = await database.transaction().execute(async (transaction) => {
        await findThread(transaction, actor.documentId, threadId, true)
        const { count } = await transaction
          .selectFrom('comment')
          .select((expression) => expression.fn.countAll<string>().as('count'))
          .where('threadId', '=', threadId)
          .executeTakeFirstOrThrow()
        if (Number(count) >= MAX_COMMENTS_PER_THREAD) throw new CommentLimitError()
        await transaction
          .insertInto('comment')
          .values({
            id: crypto.randomUUID(),
            threadId,
            authorId: userId,
            agent: input.agent ?? null,
            body: input.body
          })
          .execute()
        return touched(transaction, actor.documentId, threadId)
      })
      announce(actor.documentId, threadId)
      return thread
    },

    /** Changes what a comment says; only its author may, so no one puts words in another's mouth. */
    async updateComment(
      actor: CommentActor,
      threadId: string,
      commentId: string,
      input: UpdateCommentInput
    ): Promise<CloudCommentThread> {
      const userId = requireCommenter(actor)
      const thread = await database.transaction().execute(async (transaction) => {
        await findThread(transaction, actor.documentId, threadId, true)
        const comment = await findComment(transaction, threadId, commentId)
        if (comment.authorId !== userId) throw new DocumentForbiddenError()
        await transaction
          .updateTable('comment')
          .set({ body: input.body, editedAt: new Date() })
          .where('id', '=', commentId)
          .execute()
        return touched(transaction, actor.documentId, threadId)
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
        await findThread(transaction, actor.documentId, threadId, true)
        const comment = await findComment(transaction, threadId, commentId)
        if (comment.authorId !== userId && !actor.canModerate) throw new DocumentForbiddenError()
        if (comment.first) {
          await transaction.deleteFrom('commentThread').where('id', '=', threadId).execute()
          return null
        }
        await transaction.deleteFrom('comment').where('id', '=', commentId).execute()
        return touched(transaction, actor.documentId, threadId)
      })
      announce(actor.documentId, threadId)
      return thread
    }
  }
}

export type CommentService = ReturnType<typeof createCommentService>
