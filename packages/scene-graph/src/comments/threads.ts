import type { SceneGraph } from '../index'
import type { Color, Vector } from '../primitives'
import { randomHex } from '../random'
import type { CommentReply, CommentThread, SceneNode } from '../types'

/** Who writes a comment: their name and, in a collaboration room, their color. */
export interface CommentAuthor {
  name: string
  color?: Color
}

function newCommentId(prefix: 'c' | 'r'): string {
  return `${prefix}_${randomHex(8)}`
}

/** When a comment is written or changed, as stored: an ISO timestamp. */
export function commentTimestamp(): string {
  return new Date().toISOString()
}

/** Oldest first, the order threads and replies are shown and numbered in. */
export function byCreatedAt(a: { createdAt: string }, b: { createdAt: string }): number {
  return a.createdAt.localeCompare(b.createdAt)
}

/** A thread's replies, without the deleted ones kept as tombstones. */
export function liveReplies(thread: CommentThread): CommentReply[] {
  return thread.replies.filter((entry) => !entry.deleted)
}

/** Whether `author` started the thread or replied to it, as Figma's "Only your threads" counts. */
export function takesPartInThread(thread: CommentThread, author: string): boolean {
  return thread.author === author || liveReplies(thread).some((entry) => entry.author === author)
}

/** The thread with `id`, unless it is missing or deleted. */
export function findLiveCommentThread(
  threads: readonly CommentThread[],
  id: string
): CommentThread | undefined {
  return threads.find((thread) => thread.id === id && !thread.deleted)
}

/**
 * The layer a comment on `node` is kept on: its top-level layer, as Figma attaches comments, or
 * within a section the section's own child, as frames move about inside it.
 */
function commentLayer(graph: SceneGraph, node: SceneNode, pageId: string): SceneNode {
  const isSection = (id: string | null) => !!id && graph.getNode(id)?.type === 'SECTION'
  return (
    graph.closest(node.id, (layer) => layer.parentId === pageId || isSection(layer.parentId)) ??
    node
  )
}

/**
 * Where a pin at a canvas point is kept: on the top-level layer under it, or on `node`'s when
 * given, so it follows that layer; on the canvas when nothing is there.
 */
export function commentAnchor(graph: SceneGraph, pageId: string, at: Vector, node?: SceneNode) {
  const target = node ?? graph.hitTest(at.x, at.y, pageId)
  const layer = target ? commentLayer(graph, target, pageId) : null
  const abs = layer ? graph.getAbsolutePosition(layer.id) : null
  return {
    nodeId: layer?.id ?? null,
    nodeName: layer?.name ?? null,
    offsetX: abs ? at.x - abs.x : 0,
    offsetY: abs ? at.y - abs.y : 0,
    x: at.x,
    y: at.y
  }
}

/** Where a thread's pin is now: on its layer while that layer exists, else where it was left. */
export function commentPosition(graph: SceneGraph, thread: CommentThread): Vector {
  const node = thread.nodeId ? graph.getNode(thread.nodeId) : undefined
  if (!node) return { x: thread.x, y: thread.y }
  const abs = graph.getAbsolutePosition(node.id)
  return { x: abs.x + (thread.offsetX ?? 0), y: abs.y + (thread.offsetY ?? 0) }
}

/** A new thread pinned at a canvas point of a page. */
export function createCommentThread(
  graph: SceneGraph,
  options: {
    pageId: string
    at: Vector
    /** Pin it on this layer's top-level layer rather than on whatever is at `at`. */
    node?: SceneNode
    author: CommentAuthor
    text: string
    now: string
  }
): CommentThread {
  const { pageId, at, node, author, text, now } = options
  return {
    id: newCommentId('c'),
    pageId,
    pageName: graph.getNode(pageId)?.name,
    ...commentAnchor(graph, pageId, at, node),
    author: author.name,
    authorColor: author.color,
    text,
    createdAt: now,
    updatedAt: now,
    resolved: false,
    replies: []
  }
}

export function createCommentReply(author: CommentAuthor, text: string, now: string): CommentReply {
  return {
    id: newCommentId('r'),
    author: author.name,
    authorColor: author.color,
    text,
    createdAt: now
  }
}

/** The threads with one changed and marked as edited at `now`, for merging with other copies. */
export function editCommentThread(
  threads: readonly CommentThread[],
  id: string,
  now: string,
  edit: (thread: CommentThread) => CommentThread
): CommentThread[] {
  return threads.map((thread) => (thread.id === id ? { ...edit(thread), updatedAt: now } : thread))
}

/** A reply ends up in the thread and reopens it, as answering a resolved comment does. */
export function replyToCommentThread(thread: CommentThread, reply: CommentReply): CommentThread {
  return { ...thread, resolved: false, resolvedAt: null, replies: [...thread.replies, reply] }
}

export function resolveCommentThread(
  thread: CommentThread,
  resolved: boolean,
  now: string
): CommentThread {
  return { ...thread, resolved, resolvedAt: resolved ? now : null }
}

/** Deleted threads and replies stay as tombstones, so a stale copy cannot bring them back. */
export function deleteCommentThread(thread: CommentThread): CommentThread {
  return { ...thread, deleted: true }
}

export function deleteCommentReply(thread: CommentThread, replyId: string): CommentThread {
  return {
    ...thread,
    replies: thread.replies.map((entry) =>
      entry.id === replyId ? { ...entry, deleted: true } : entry
    )
  }
}
