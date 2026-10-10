import {
  byCreatedAt,
  commentPosition,
  commentTimestamp as now,
  createCommentReply,
  createCommentThread,
  deleteCommentThread,
  editCommentThread,
  findLiveCommentThread,
  liveReplies,
  readComments,
  replyToCommentThread,
  resolveCommentThread,
  takesPartInThread,
  writeComments,
  type CommentAuthor,
  type CommentThread,
  type SceneGraph
} from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { nodeOf, type NodeRef } from './behaviours'

/** Who scripts and agents comment as when they give no name. */
export const DEFAULT_COMMENT_AUTHOR = 'Agent'

export interface CommentFilter {
  /** true for resolved threads only, false for open ones; both when left out. */
  resolved?: boolean
  /** Only threads on this page. */
  page?: NodeRef
  /** Only threads this person started or replied to. */
  author?: string
}

export interface NewComment {
  /** Pin the comment on this layer; it follows the top-level layer it lands on. */
  node?: NodeRef
  /** The page to comment on without a layer; the current page by default. */
  page?: NodeRef
  /** Canvas position on the page, or offset from the layer's top-left corner. */
  x?: number
  y?: number
  author?: string
}

function author(name: string | undefined): CommentAuthor {
  return { name: name?.trim() || DEFAULT_COMMENT_AUTHOR }
}

function pageOf(graph: SceneGraph, nodeId: string): string {
  const page = graph.closest(nodeId, (node) => node.type === 'CANVAS')
  if (!page) throw new Error(`${graph.getNode(nodeId)?.name ?? nodeId} is not on a page`)
  return page.id
}

/**
 * A comment thread as scripts read and answer it, in the style of the Figma API: properties
 * read the thread as the document holds it now, and every change is written at once, where
 * the editor and collaborators see it.
 */
export class CommentHandle {
  constructor(
    private readonly graph: SceneGraph,
    readonly id: string
  ) {}

  private get thread(): CommentThread {
    const thread = findLiveCommentThread(readComments(this.graph), this.id)
    if (!thread) throw new Error(`Comment ${this.id} was deleted`)
    return thread
  }

  private edit(change: (thread: CommentThread) => CommentThread): this {
    const threads = readComments(this.graph)
    if (!findLiveCommentThread(threads, this.id)) throw new Error(`Comment ${this.id} was deleted`)
    writeComments(this.graph, editCommentThread(threads, this.id, now(), change))
    return this
  }

  get text(): string {
    return this.thread.text
  }

  get author(): string {
    return this.thread.author
  }

  get createdAt(): string {
    return this.thread.createdAt
  }

  get resolved(): boolean {
    return this.thread.resolved
  }

  /** The page the comment is on. */
  get page(): { id: string; name: string } {
    const { pageId, pageName } = this.thread
    return { id: pageId, name: this.graph.getNode(pageId)?.name ?? pageName ?? '' }
  }

  /** The top-level layer the comment is pinned to, while it exists. */
  get node(): { id: string; name: string } | null {
    const { nodeId } = this.thread
    const node = nodeId ? this.graph.getNode(nodeId) : undefined
    return node ? { id: node.id, name: node.name } : null
  }

  /** Where the pin is on the page's canvas. */
  get position(): Vector {
    return commentPosition(this.graph, this.thread)
  }

  get replies(): { id: string; author: string; text: string; createdAt: string }[] {
    return liveReplies(this.thread).map(({ id, author, text, createdAt }) => ({
      id,
      author,
      text,
      createdAt
    }))
  }

  /** Answer the thread, which reopens it if it was resolved. */
  reply(text: string, options: { author?: string } = {}): this {
    const body = text.trim()
    if (!body) throw new Error('A reply needs text')
    const entry = createCommentReply(author(options.author), body, now())
    return this.edit((thread) => replyToCommentThread(thread, entry))
  }

  resolve(): this {
    return this.edit((thread) => resolveCommentThread(thread, true, now()))
  }

  reopen(): this {
    return this.edit((thread) => resolveCommentThread(thread, false, now()))
  }

  /** Delete the thread and its replies for everyone. */
  remove(): void {
    this.edit(deleteCommentThread)
  }

  toJSON() {
    return {
      id: this.id,
      text: this.text,
      author: this.author,
      createdAt: this.createdAt,
      resolved: this.resolved,
      page: this.page,
      node: this.node,
      position: this.position,
      replies: this.replies
    }
  }
}

/** The document's live threads, oldest first, narrowed by `filter`. */
export function getComments(graph: SceneGraph, filter: CommentFilter = {}): CommentHandle[] {
  const pageId = filter.page === undefined ? undefined : nodeOf(graph, filter.page).id
  return readComments(graph)
    .filter(
      (thread) =>
        !thread.deleted &&
        (filter.resolved === undefined || thread.resolved === filter.resolved) &&
        (pageId === undefined || thread.pageId === pageId) &&
        (filter.author === undefined || takesPartInThread(thread, filter.author))
    )
    .sort(byCreatedAt)
    .map((thread) => new CommentHandle(graph, thread.id))
}

export function getComment(graph: SceneGraph, id: string): CommentHandle | null {
  return findLiveCommentThread(readComments(graph), id) ? new CommentHandle(graph, id) : null
}

/** Leave a comment on a layer, or at a point of a page. */
export function addComment(
  graph: SceneGraph,
  currentPageId: string,
  text: string,
  options: NewComment = {}
): CommentHandle {
  const body = text.trim()
  if (!body) throw new Error('A comment needs text')
  const dx = options.x ?? 0
  const dy = options.y ?? 0
  let pageId: string
  let at: Vector
  const node = options.node === undefined ? undefined : nodeOf(graph, options.node)
  if (node) {
    pageId = pageOf(graph, node.id)
    const abs = graph.getAbsolutePosition(node.id)
    at = { x: abs.x + dx, y: abs.y + dy }
  } else {
    pageId = options.page === undefined ? currentPageId : nodeOf(graph, options.page).id
    if (graph.getNode(pageId)?.type !== 'CANVAS') throw new Error(`${pageId} is not a page`)
    at = { x: dx, y: dy }
  }
  const thread = createCommentThread(graph, {
    pageId,
    at,
    node,
    author: author(options.author),
    text: body,
    now: now()
  })
  writeComments(graph, [...readComments(graph), thread])
  return new CommentHandle(graph, thread.id)
}
