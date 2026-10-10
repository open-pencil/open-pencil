import type { CommentReply, CommentThread } from '../types'
import { byCreatedAt } from './threads'

function mergeReplies(first: CommentReply[], second: CommentReply[]): CommentReply[] {
  const byId = new Map<string, CommentReply>()
  for (const reply of [...first, ...second]) {
    const existing = byId.get(reply.id)
    // A deletion is never undone by an older copy of the same reply.
    byId.set(
      reply.id,
      existing ? { ...existing, ...reply, deleted: existing.deleted || reply.deleted } : reply
    )
  }
  return [...byId.values()].sort(byCreatedAt)
}

/**
 * Two copies of a document's comments become one. Nothing is lost: threads and replies are
 * joined by id, and for a thread both copies changed, the newer edit wins while replies from
 * both are kept. Deleted threads and replies stay deleted.
 */
export function mergeCommentThreads(
  local: readonly CommentThread[],
  remote: readonly CommentThread[]
): CommentThread[] {
  const byId = new Map<string, CommentThread>()
  for (const thread of remote) byId.set(thread.id, thread)
  for (const thread of local) {
    const other = byId.get(thread.id)
    if (!other) {
      byId.set(thread.id, thread)
      continue
    }
    const newer = thread.updatedAt >= other.updatedAt ? thread : other
    byId.set(thread.id, {
      ...newer,
      deleted: thread.deleted || other.deleted,
      replies: mergeReplies(other.replies, thread.replies)
    })
  }
  return [...byId.values()].sort(byCreatedAt)
}

/**
 * Whether `local` holds anything `remote` lacks: a thread or reply it does not have, a newer edit,
 * or a deletion. Merging is then needed; otherwise `remote` already says everything.
 */
export function hasNewerComments(
  local: readonly CommentThread[],
  remote: readonly CommentThread[]
): boolean {
  const remoteById = new Map(remote.map((thread) => [thread.id, thread]))
  return local.some((thread) => {
    const other = remoteById.get(thread.id)
    if (!other) return true
    if (thread.updatedAt > other.updatedAt || (thread.deleted && !other.deleted)) return true
    const replies = new Map(other.replies.map((entry) => [entry.id, entry]))
    return thread.replies.some((entry) => {
      const known = replies.get(entry.id)
      return !known || (!!entry.deleted && !known.deleted)
    })
  })
}
