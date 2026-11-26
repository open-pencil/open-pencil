import type { CloudComment, CloudCommentThread } from '@open-pencil/cloud/contract'
import { messageStores } from '@open-pencil/vue/i18n'

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
 * The comment of `thread` to tell the person about, as the server tells them by email: one not
 * `heard` before, by someone else, that names them, or else one in a thread they wrote in. Edits,
 * comments brought in from a file, and the person's own add nothing.
 */
export function commentNotice(
  thread: CloudCommentThread | null,
  accountId: string | null,
  heard: ReadonlySet<string>
): CommentNotice | null {
  if (!thread || !accountId) return null
  const added = thread.comments.filter(
    (comment) =>
      !heard.has(comment.id) && comment.author.kind === 'user' && !writtenBy(comment, accountId)
  )
  const mention = added.findLast((comment) => comment.mentions.includes(accountId))
  if (mention) return { event: 'commentMention', comment: mention }
  const reply = added.at(-1)
  const wroteHere = thread.comments.some((comment) => writtenBy(comment, accountId))
  return reply && wroteHere ? { event: 'commentReply', comment: reply } : null
}

/**
 * Notifies about a comment in `store`'s document; a click shows its tab with the thread open. One
 * per thread, so a busy thread replaces its last notification.
 */
export function notifyComment(store: EditorStore, threadId: string, notice: CommentNotice): void {
  const tabId = getTabForStore(store)?.id
  if (!tabId) return
  const messages = messageStores.comments.get()
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
