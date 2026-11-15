import type { CloudComment, CloudCommentThread, CommentAnchor } from '#cloud/contract'
import { userIdText, type CloudDatabase } from '#cloud/server/db'
import { DocumentNotFoundError } from '#cloud/server/documents/errors'
import { groupBy } from 'es-toolkit'
import type { Kysely, Transaction } from 'kysely'

export type Source = Kysely<CloudDatabase> | Transaction<CloudDatabase>

export type ThreadRow = {
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
  mentions: string[]
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
    mentions: row.mentions,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null
  }
}

/**
 * Whether someone other than `viewer` wrote in the thread since `readAt`, or at all when the viewer
 * never read it; never for a guest, who has no account to keep it for.
 */
function unreadBy(
  comments: readonly CommentRow[],
  viewer: string | null,
  readAt: Date | undefined
): boolean {
  if (viewer === null) return false
  return comments.some(
    (comment) => comment.authorId !== viewer && (!readAt || comment.createdAt > readAt)
  )
}

export function threadOf(
  row: ThreadRow,
  comments: readonly CommentRow[],
  viewer: string | null,
  readAt: Date | undefined
): CloudCommentThread {
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
    unread: unreadBy(comments, viewer, readAt),
    comments: comments.map(commentOf)
  }
}

export function anchorValues(anchor: CommentAnchor) {
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

/** Holds the document's row, so one writer at a time counts and adds its threads. */
export async function lockDocument(transaction: Transaction<CloudDatabase>, documentId: string) {
  await transaction
    .selectFrom('document')
    .select('id')
    .where('id', '=', documentId)
    .forUpdate()
    .executeTakeFirstOrThrow()
}

/** What resolving or reopening sets, or nothing when the thread already is as asked. */
export function resolutionChange(
  resolved: boolean | undefined,
  isResolved: boolean,
  userId: string
) {
  if (resolved === undefined || resolved === isResolved) return {}
  return resolved
    ? { resolvedAt: new Date(), resolvedBy: userId }
    : { resolvedAt: null, resolvedBy: null }
}

/** Threads with what a reply shows of them, to narrow by document or ID. */
export function threads(source: Source) {
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

/** The threads' comments, oldest first, each with whom it names. */
export async function comments(
  source: Source,
  threadIds: readonly string[]
): Promise<CommentRow[]> {
  const rows = await source
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
  if (rows.length === 0) return []
  const mentions = groupBy(
    await source
      .selectFrom('commentMention')
      .select(['commentId', 'userId'])
      .where(
        'commentId',
        'in',
        rows.map((row) => row.id)
      )
      .orderBy('createdAt')
      .execute(),
    (mention) => mention.commentId
  )
  return rows.map((row) => ({
    ...row,
    mentions: (mentions[row.id] ?? []).map((mention) => mention.userId)
  }))
}

/** When `viewer` last read each of the threads. */
export async function readsOf(source: Source, viewer: string | null, threadIds: readonly string[]) {
  if (viewer === null || threadIds.length === 0) return new Map<string, Date>()
  const rows = await source
    .selectFrom('commentRead')
    .select(['threadId', 'readAt'])
    .where('userId', '=', viewer)
    .where('threadId', 'in', [...threadIds])
    .execute()
  return new Map(rows.map((row) => [row.threadId, row.readAt]))
}

/** Records that `userId` has read the thread as it is now. */
export async function markRead(source: Source, userId: string, threadId: string) {
  const readAt = new Date()
  await source
    .insertInto('commentRead')
    .values({ userId, threadId, readAt })
    .onConflict((conflict) => conflict.columns(['userId', 'threadId']).doUpdateSet({ readAt }))
    .execute()
}

export async function findThread(
  source: Source,
  documentId: string,
  threadId: string,
  lock = false
) {
  let query = threads(source)
    .where('commentThread.documentId', '=', documentId)
    .where('commentThread.id', '=', threadId)
  if (lock) query = query.forUpdate()
  const row = await query.executeTakeFirst()
  if (!row) throw new DocumentNotFoundError()
  return row
}
