import type { CloudComment, CloudCommentThread } from '@open-pencil/cloud/contract'
import { commentMessages } from '@open-pencil/vue/i18n'

import { commentPreview } from '@/app/comments/format'
import { useComments } from '@/app/comments/use'
import type { EditorStore } from '@/app/editor/session'
import { notify } from '@/app/shell/notifications'
import { getTabForStore, switchTab } from '@/app/tabs'

/** What a thread someone else changed has for the person: a comment naming them, or a reply. */
export type CommentNotice = {
  event: 'commentMention' | 'commentReply'
  comment: CloudComment
}

const writtenBy = (comment: CloudComment, accountId: string) =>
  comment.author.kind === 'user' && comment.author.id === accountId

/**
 * The comment to tell the person about once a thread changed from `before` to `after`, as the
 * server tells them by email: a new comment by someone else that names them, or else one in a
 * thread they wrote in. Edits, comments brought in from a file, and the person's own add nothing.
 */
export function commentNotice(
  before: CloudCommentThread | undefined,
  after: CloudCommentThread | null,
  accountId: string | null
): CommentNotice | null {
  if (!after || !accountId) return null
  const known = new Set(before?.comments.map((comment) => comment.id))
  const added = after.comments.filter(
    (comment) =>
      !known.has(comment.id) && comment.author.kind === 'user' && !writtenBy(comment, accountId)
  )
  const mention = added.findLast((comment) => comment.mentions.includes(accountId))
  if (mention) return { event: 'commentMention', comment: mention }
  const reply = added.at(-1)
  const wroteHere = after.comments.some((comment) => writtenBy(comment, accountId))
  return reply && wroteHere ? { event: 'commentReply', comment: reply } : null
}

/**
 * Notifies about a comment in `store`'s document; a click shows its tab with the thread open. One
 * per thread, so a busy thread replaces its last notification.
 */
export function notifyComment(store: EditorStore, threadId: string, notice: CommentNotice): void {
  const tabId = getTabForStore(store)?.id
  if (!tabId) return
  const messages = commentMessages.get()
  notify({
    event: notice.event,
    title: messages.notifyTitle({
      author: notice.comment.author.name ?? messages.someone,
      document: store.state.documentName
    }),
    body: commentPreview(notice.comment.body),
    tabId,
    tag: `comment:${threadId}`,
    open: () => {
      if (!switchTab(tabId)) return
      void useComments().focusThread(threadId)
    }
  })
}
