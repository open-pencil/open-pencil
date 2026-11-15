import type {
  CloudComment,
  CloudCommentThread,
  CommentAnchor,
  ImportCommentThreadsInput,
  UpdateCommentThreadInput
} from '@open-pencil/cloud/contract'
import type { CommentReply, CommentThread } from '@open-pencil/scene-graph'

/**
 * A change the document's comments hold that its server does not have yet, as the requests that
 * make it there. Threads and comments are only ever deleted by their tombstones: one the document
 * lacks, as a file opened in its place does, is one it has not seen yet.
 */
export type CloudCommentChange =
  | { kind: 'create-thread'; thread: CommentThread }
  | { kind: 'update-thread'; threadId: string; input: UpdateCommentThreadInput }
  | { kind: 'delete-thread'; threadId: string }
  | { kind: 'reply'; threadId: string; reply: CommentReply }
  | { kind: 'edit'; threadId: string; commentId: string; body: string }
  | { kind: 'delete-comment'; threadId: string; commentId: string }

function authorName(comment: CloudComment): string {
  // An account deleted since has no name; the comment shows as someone's.
  return comment.author.name ?? ''
}

function replyOf(comment: CloudComment): CommentReply {
  return {
    id: comment.id,
    author: authorName(comment),
    agent: comment.agent ?? undefined,
    text: comment.body,
    createdAt: comment.createdAt
  }
}

/** The comment that started a thread; the server deletes a thread with it, so each has one. */
function firstComment(thread: CloudCommentThread): CloudComment {
  if (thread.comments.length === 0) throw new Error(`Comment thread ${thread.id} has no comments`)
  return thread.comments[0]
}

/** A thread as the document holds it, from the server's copy. */
export function documentThread(thread: CloudCommentThread): CommentThread {
  const first = firstComment(thread)
  return {
    id: thread.id,
    pageId: thread.pageId,
    pageName: thread.pageName ?? undefined,
    nodeId: thread.nodeId,
    nodeName: thread.nodeName,
    offsetX: thread.offsetX ?? undefined,
    offsetY: thread.offsetY ?? undefined,
    x: thread.x,
    y: thread.y,
    author: authorName(first),
    agent: first.agent ?? undefined,
    text: first.body,
    createdAt: first.createdAt,
    updatedAt: thread.updatedAt,
    resolved: thread.resolvedAt !== null,
    resolvedAt: thread.resolvedAt,
    replies: thread.comments.slice(1).map(replyOf)
  }
}

/** Where a thread's pin sits, as the server takes it. */
export function threadAnchor(thread: CommentThread): CommentAnchor {
  return {
    pageId: thread.pageId,
    pageName: thread.pageName ?? null,
    nodeId: thread.nodeId ?? null,
    nodeName: thread.nodeName ?? null,
    offsetX: thread.offsetX ?? null,
    offsetY: thread.offsetY ?? null,
    x: thread.x,
    y: thread.y
  }
}

function anchorMoved(local: CommentThread, server: CloudCommentThread): boolean {
  const anchor = threadAnchor(local)
  return (
    anchor.pageId !== server.pageId ||
    anchor.nodeId !== server.nodeId ||
    anchor.offsetX !== server.offsetX ||
    anchor.offsetY !== server.offsetY ||
    anchor.x !== server.x ||
    anchor.y !== server.y
  )
}

function threadChanges(local: CommentThread, server: CloudCommentThread): CloudCommentChange[] {
  const threadId = local.id
  if (local.deleted) return [{ kind: 'delete-thread', threadId }]
  const changes: CloudCommentChange[] = []
  const first = firstComment(server)
  if (local.text !== first.body) {
    changes.push({ kind: 'edit', threadId, commentId: first.id, body: local.text })
  }
  const known = new Map(server.comments.slice(1).map((comment) => [comment.id, comment]))
  for (const reply of local.replies) {
    const stored = known.get(reply.id)
    if (!stored) {
      if (!reply.deleted) changes.push({ kind: 'reply', threadId, reply })
    } else if (reply.deleted) {
      changes.push({ kind: 'delete-comment', threadId, commentId: reply.id })
    } else if (reply.text !== stored.body) {
      changes.push({ kind: 'edit', threadId, commentId: reply.id, body: reply.text })
    }
  }
  // Replying reopens a thread, so whether it is resolved is settled after the replies.
  const input: UpdateCommentThreadInput = {}
  if (local.resolved !== (server.resolvedAt !== null)) input.resolved = local.resolved
  if (anchorMoved(local, server)) input.anchor = threadAnchor(local)
  if (input.resolved !== undefined || input.anchor) {
    changes.push({ kind: 'update-thread', threadId, input })
  }
  return changes
}

/** What the document's comments changed that the server's copy does not have, in order. */
export function cloudCommentChanges(
  local: readonly CommentThread[],
  server: ReadonlyMap<string, CloudCommentThread>
): CloudCommentChange[] {
  return local.flatMap((thread) => {
    const stored = server.get(thread.id)
    if (stored) return threadChanges(thread, stored)
    if (thread.deleted) return []
    return [
      { kind: 'create-thread' as const, thread },
      ...thread.replies
        .filter((reply) => !reply.deleted)
        .map((reply) => ({ kind: 'reply' as const, threadId: thread.id, reply })),
      ...(thread.resolved
        ? [{ kind: 'update-thread' as const, threadId: thread.id, input: { resolved: true } }]
        : [])
    ]
  })
}

/** A file's time as the server takes it; an older file may have left one out. */
function importTime(value: string, fallback: string): string {
  return Number.isNaN(Date.parse(value)) ? fallback : new Date(value).toISOString()
}

/** The threads a file brought with it, to keep on the server under the names it gave. */
export function importedThreads(
  threads: readonly CommentThread[],
  now = new Date().toISOString()
): ImportCommentThreadsInput {
  return {
    threads: threads.flatMap((thread) => {
      if (thread.deleted || !thread.text.trim()) return []
      const createdAt = importTime(thread.createdAt, now)
      return [
        {
          ...threadAnchor(thread),
          createdAt,
          resolved: thread.resolved,
          comments: [
            { authorName: thread.author, body: thread.text.trim(), createdAt },
            ...thread.replies.flatMap((reply) =>
              reply.deleted || !reply.text.trim()
                ? []
                : [
                    {
                      authorName: reply.author,
                      body: reply.text.trim(),
                      createdAt: importTime(reply.createdAt, createdAt)
                    }
                  ]
            )
          ]
        }
      ]
    })
  }
}

/** The thread change's own thread, which each kind names in its own way. */
export function changedThreadId(change: CloudCommentChange): string {
  return change.kind === 'create-thread' ? change.thread.id : change.threadId
}

function withResolution(thread: CloudCommentThread, from: CloudCommentThread): CloudCommentThread {
  return { ...thread, resolvedAt: from.resolvedAt, resolvedBy: from.resolvedBy }
}

function withAnchor(thread: CloudCommentThread, from: CloudCommentThread): CloudCommentThread {
  return {
    ...thread,
    pageId: from.pageId,
    pageName: from.pageName,
    nodeId: from.nodeId,
    nodeName: from.nodeName,
    offsetX: from.offsetX,
    offsetY: from.offsetY,
    x: from.x,
    y: from.y
  }
}

/**
 * What the tab's comments were told from once the server took one change: what they were, with
 * that change and nothing else, so what someone else changed meanwhile, which the answer may
 * carry, is shown as theirs rather than taken for an edit of the tab's. Null once it is gone.
 */
export function acknowledged(
  before: CloudCommentThread | undefined,
  change: CloudCommentChange,
  after: CloudCommentThread | null
): CloudCommentThread | null {
  if (!after || change.kind === 'delete-thread') return null
  if (!before || change.kind === 'create-thread') return after
  switch (change.kind) {
    case 'update-thread': {
      const resolved = change.input.resolved === undefined ? before : withResolution(before, after)
      return change.input.anchor ? withAnchor(resolved, after) : resolved
    }
    case 'reply': {
      const added = after.comments.find((comment) => comment.id === change.reply.id)
      const known = before.comments.some((comment) => comment.id === change.reply.id)
      return added && !known ? { ...before, comments: [...before.comments, added] } : before
    }
    case 'edit':
      return {
        ...before,
        comments: before.comments.map(
          (comment) =>
            (comment.id === change.commentId
              ? after.comments.find((edited) => edited.id === comment.id)
              : undefined) ?? comment
        )
      }
  }
  return {
    ...before,
    comments: before.comments.filter((comment) => comment.id !== change.commentId)
  }
}
