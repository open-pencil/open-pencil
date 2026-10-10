import type { CommentThread } from '../types'
import { byCreatedAt, liveReplies, takesPartInThread } from './threads'

export const COMMENT_SORTS = ['newest', 'oldest'] as const
export type CommentSort = (typeof COMMENT_SORTS)[number]

export interface CommentListOptions {
  query: string
  showResolved: boolean
  /** Only threads on `pageId`. */
  onlyPage: boolean
  pageId: string
  /** Only threads `author` started or replied to. */
  onlyMine: boolean
  author: string
  sort: CommentSort
}

function matches(thread: CommentThread, query: string): boolean {
  const words = [thread.text, thread.author, thread.nodeName ?? '', thread.pageName ?? '']
  for (const entry of liveReplies(thread)) words.push(entry.text, entry.author)
  return words.some((word) => word.toLocaleLowerCase().includes(query))
}

/**
 * Each thread's number, counted in the order threads were started, as Figma numbers them in its
 * list. Deleted threads keep their place so the numbers people refer to do not shift.
 */
export function commentThreadNumbers(threads: readonly CommentThread[]): Map<string, number> {
  const started = threads.toSorted(byCreatedAt)
  return new Map(started.map((thread, index) => [thread.id, index + 1]))
}

/** The threads the comments list shows for its search, filters and order. */
export function listCommentThreads(
  threads: readonly CommentThread[],
  options: CommentListOptions
): CommentThread[] {
  const query = options.query.trim().toLocaleLowerCase()
  const author = options.author.trim()
  const listed = threads.filter(
    (thread) =>
      !thread.deleted &&
      (options.showResolved || !thread.resolved) &&
      (!options.onlyPage || thread.pageId === options.pageId) &&
      (!options.onlyMine || (author !== '' && takesPartInThread(thread, author))) &&
      (query === '' || matches(thread, query))
  )
  // Ordered by when each thread was started, as Figma's "Sort by date" is.
  const direction = options.sort === 'newest' ? -1 : 1
  return listed.sort((a, b) => direction * byCreatedAt(a, b))
}
